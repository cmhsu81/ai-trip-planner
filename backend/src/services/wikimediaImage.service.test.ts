import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ItineraryDraft } from "../types";
import { enrichAttractionImages } from "./wikimediaImage.service";

function makeDraft(overrides?: Partial<ItineraryDraft>): ItineraryDraft {
  return {
    destination: "Kyoto",
    summary: "A trip to Kyoto",
    feasibilityNotes: [],
    days: [
      {
        day: 1,
        items: [
          { title: "Fushimi Inari Shrine", type: "attraction" },
        ],
      },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("enrichAttractionImages", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets imageUrl on an attraction item with no existing image from a successful Wikipedia response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        query: {
          pages: {
            "123": { thumbnail: { source: "https://upload.wikimedia.org/fushimi.jpg" } },
          },
        },
      })
    );

    const draft = makeDraft();
    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBe("https://upload.wikimedia.org/fushimi.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calledUrl = fetchMock.mock.calls[0][0] as URL;
    const url = new URL(calledUrl.toString());
    expect(url.searchParams.get("gsrsearch")).toBe("Fushimi Inari Shrine Kyoto");
  });

  it("leaves an item with an existing imageUrl untouched", async () => {
    const draft = makeDraft({
      days: [
        {
          day: 1,
          items: [
            {
              title: "Fushimi Inari Shrine",
              type: "attraction",
              imageUrl: "https://existing.example.com/image.jpg",
            },
          ],
        },
      ],
    });

    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBe("https://existing.example.com/image.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never looks up a non-attraction item", async () => {
    const draft = makeDraft({
      days: [
        {
          day: 1,
          items: [
            { title: "Dinner at Nishiki Market", type: "restaurant" },
            { title: "Train to Kyoto", type: "transport" },
          ],
        },
      ],
    });

    const result = await enrichAttractionImages(draft);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.days[0].items[0].imageUrl).toBeUndefined();
    expect(result.days[0].items[1].imageUrl).toBeUndefined();
  });

  it("leaves imageUrl unset when Wikipedia returns no matching page", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: {} }));

    const draft = makeDraft();
    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBeUndefined();
  });

  it("leaves imageUrl unset when the response has no query field at all", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    const draft = makeDraft();
    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBeUndefined();
  });

  it("swallows a network failure (fetch rejects) without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const draft = makeDraft();
    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBeUndefined();
  });

  it("swallows a non-OK response status without throwing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));

    const draft = makeDraft();
    const result = await enrichAttractionImages(draft);

    expect(result.days[0].items[0].imageUrl).toBeUndefined();
  });

  it("processes multiple days and items, filling in images only where applicable", async () => {
    fetchMock.mockImplementation(async (url: URL) => {
      const search = new URL(url.toString()).searchParams.get("gsrsearch");
      if (search?.includes("Kinkaku-ji")) {
        return jsonResponse({
          query: { pages: { "1": { thumbnail: { source: "https://example.com/kinkakuji.jpg" } } } },
        });
      }
      // No match for anything else.
      return jsonResponse({ query: {} });
    });

    const draft = makeDraft({
      days: [
        {
          day: 1,
          items: [
            { title: "Kinkaku-ji", type: "attraction" },
            { title: "Lunch", type: "restaurant" },
          ],
        },
        {
          day: 2,
          date: "2026-09-02",
          items: [
            { title: "Arashiyama Bamboo Grove", type: "attraction" },
            { title: "Taxi to hotel", type: "transport" },
          ],
        },
      ],
    });

    const result = await enrichAttractionImages(draft);

    expect(result.destination).toBe("Kyoto");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].items).toHaveLength(2);
    expect(result.days[1].items).toHaveLength(2);
    expect(result.days[1].date).toBe("2026-09-02");

    expect(result.days[0].items[0].imageUrl).toBe("https://example.com/kinkakuji.jpg");
    expect(result.days[0].items[1].imageUrl).toBeUndefined();
    expect(result.days[1].items[0].imageUrl).toBeUndefined();
    expect(result.days[1].items[1].imageUrl).toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
