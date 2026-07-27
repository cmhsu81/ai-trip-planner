import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }),
}));

import {
  extractJson,
  extractJsonArray,
  generateItinerary,
  chatRefine,
} from "./anthropic.service";

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

const VALID_ITINERARY_JSON = JSON.stringify({
  destination: "Tokyo",
  summary: "A great trip",
  feasibilityNotes: [],
  days: [{ day: 1, date: null, items: [] }],
});

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in ```json fences", () => {
    const text = '```json\n{"a":1,"b":"two"}\n```';
    expect(extractJson(text)).toEqual({ a: 1, b: "two" });
  });

  it("parses JSON wrapped in plain ``` fences (no json tag)", () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it("parses JSON with commentary before and after", () => {
    const text = 'Sure, here is the result:\n{"a":1}\nHope that helps!';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it("throws on malformed JSON (trailing comma)", () => {
    expect(() => extractJson('{"a":1,}')).toThrow();
  });

  it("throws when there is no JSON object present", () => {
    expect(() => extractJson("no json here at all")).toThrow(
      "Claude response did not contain a JSON object"
    );
  });
});

describe("extractJsonArray", () => {
  it("parses a plain JSON array", () => {
    expect(extractJsonArray('["a","b"]')).toEqual(["a", "b"]);
  });

  it("parses a JSON array wrapped in fences", () => {
    expect(extractJsonArray('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
  });

  it("throws when there is no JSON array present", () => {
    expect(() => extractJsonArray("nothing to see here")).toThrow(
      "Claude response did not contain a JSON array"
    );
  });

  it("throws on malformed array JSON", () => {
    expect(() => extractJsonArray("[1, 2,]")).toThrow();
  });
});

describe("createJsonMessage retry loop (via generateItinerary)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const baseParams = {
    destination: "Tokyo",
    days: 3,
    arrivalTime: "10:00",
    departureTime: "18:00",
    locale: "en" as const,
    researchContext: "some notes",
  };

  it("retries once when the first response is invalid JSON, then succeeds", async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse("this is not json at all"))
      .mockResolvedValueOnce(textResponse(VALID_ITINERARY_JSON));

    const result = await generateItinerary(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.destination).toBe("Tokyo");
    expect(result.days).toHaveLength(1);
  });

  it("feeds the broken response back to Claude on retry", async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse("not json"))
      .mockResolvedValueOnce(textResponse(VALID_ITINERARY_JSON));

    await generateItinerary(baseParams);

    const secondCallArgs = mockCreate.mock.calls[1][0];
    const messages = secondCallArgs.messages;
    // original user message + assistant's bad reply + our correction request
    expect(messages.length).toBeGreaterThanOrEqual(3);
    expect(messages[messages.length - 1].role).toBe("user");
    expect(messages[messages.length - 1].content).toMatch(/not valid JSON/i);
  });

  it("gives up and throws after MAX_ATTEMPTS (3) failed attempts", async () => {
    mockCreate.mockResolvedValue(textResponse("still not json"));

    await expect(generateItinerary(baseParams)).rejects.toThrow(
      /did not return valid JSON after 3 attempts/i
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("retries when JSON is syntactically valid but missing required 'destination'/'days' fields", async () => {
    const incomplete = JSON.stringify({ summary: "missing destination and days" });
    mockCreate
      .mockResolvedValueOnce(textResponse(incomplete))
      .mockResolvedValueOnce(textResponse(VALID_ITINERARY_JSON));

    const result = await generateItinerary(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.destination).toBe("Tokyo");
  });

  it("never returns incomplete itinerary data even if it parses as JSON on every attempt", async () => {
    const incomplete = JSON.stringify({ summary: "still incomplete" });
    mockCreate.mockResolvedValue(textResponse(incomplete));

    await expect(generateItinerary(baseParams)).rejects.toThrow(
      /missing required itinerary fields/i
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});

describe("chatRefine field validation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const baseParams = {
    currentItinerary: {
      destination: "Tokyo",
      summary: "",
      feasibilityNotes: [],
      days: [],
    },
    conversationHistory: [],
    userMessage: "What's good to eat near Shibuya?",
    locale: "en" as const,
    researchContext: "notes",
  };

  it("retries when the 'reply' field is missing, then succeeds", async () => {
    const missingReply = JSON.stringify({ isChangeRequest: false });
    const valid = JSON.stringify({ reply: "Try Ichiran ramen!", isChangeRequest: false });

    mockCreate
      .mockResolvedValueOnce(textResponse(missingReply))
      .mockResolvedValueOnce(textResponse(valid));

    const result = await chatRefine(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe("Try Ichiran ramen!");
    expect(result.isChangeRequest).toBe(false);
  });

  it("throws after 3 attempts if 'reply' is always missing (never silently returns bad data)", async () => {
    const missingReply = JSON.stringify({ isChangeRequest: false });
    mockCreate.mockResolvedValue(textResponse(missingReply));

    await expect(chatRefine(baseParams)).rejects.toThrow(
      /missing the required 'reply' field/i
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("only reports isChangeRequest true when an updatedItinerary is actually present", async () => {
    const valid = JSON.stringify({ reply: "Sure, done!", isChangeRequest: true });
    mockCreate.mockResolvedValueOnce(textResponse(valid));

    const result = await chatRefine(baseParams);

    // isChangeRequest was true but updatedItinerary was omitted -> should be coerced to false
    expect(result.isChangeRequest).toBe(false);
    expect(result.updatedItinerary).toBeUndefined();
  });
});
