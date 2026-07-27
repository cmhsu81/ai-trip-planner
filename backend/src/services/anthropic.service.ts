import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { ItineraryDraft, Locale } from "../types";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

function webSearchTool(maxUses: number): Anthropic.Messages.WebSearchTool20250305 {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses };
}

// Search budgets, tuned down from a single shared max_uses: 8. Destination-level
// facts (attractions, restaurants, customs) now come from the cached
// DestinationResearch note instead of being re-searched on every call, so each
// call only needs a small budget left over for date-specific lookups (this
// week's weather, an event landing on these exact dates, etc).
const RESEARCH_SEARCH_BUDGET = 5; // one-time per destination, cached afterwards
const ITINERARY_SEARCH_BUDGET = 2; // date-specific checks only; bulk research is cached
const CHAT_SEARCH_BUDGET = 3; // targeted lookups for a single requested change
const QUICK_ANSWER_SEARCH_BUDGET = 3; // answering one focused question

type Tools = Anthropic.MessageCreateParamsNonStreaming["tools"];

function languageName(locale: Locale): string {
  return locale === "zh" ? "Traditional Chinese (繁體中文)" : "English";
}

function languageInstruction(locale: Locale): string {
  return `Write all human-readable text (summary, feasibilityNotes, descriptions, sourceNote, replies, answers, labels) in ${languageName(
    locale
  )}. Place names / proper nouns may stay in their common form.`;
}

const ITINERARY_JSON_SHAPE = `{
  "destination": string,
  "summary": string,          // 2-3 sentence overview of the trip and why this plan fits the traveler
  "feasibilityNotes": string[], // warnings/considerations: weather, holidays/events, opening hours, travel time between stops, budget concerns
  "days": [
    {
      "day": number,           // 1-indexed
      "date": string | null,   // ISO date if a start date was given, otherwise null
      "items": [
        {
          "time": string,      // e.g. "09:00"
          "title": string,
          "type": "attraction" | "restaurant" | "activity" | "transport" | "lodging",
          "description": string,
          "location": string,
          "estimatedDuration": string, // e.g. "1.5 hours"
          "sourceNote": string  // brief note on why recommended / what source informed it (e.g. "highly rated on Google Maps & TripAdvisor", "featured in 2025 travel news")
        }
      ]
    }
  ]
}`;

function buildSystemPrompt(locale: Locale, researchContext: string): string {
  return `You are an expert AI travel planner.

Pre-researched notes about this destination (attractions, restaurants, customs, typical weather, recent news) — treat this as your primary source instead of re-searching it from scratch:
"""
${researchContext}
"""

You also have a web_search tool with a small remaining budget — use it ONLY for things the notes above can't cover: the weather forecast or events landing specifically within the traveler's exact travel dates. Don't re-research general attractions/restaurants that are already covered in the notes.

Use the notes and any date-specific search results to ground your recommendations in current, real information rather than guessing. Judge feasibility: flag anything unrealistic (too many stops in one day, conflicting travel times, seasonal closures, extreme weather, arriving/leaving too late/early for planned activities) inside "feasibilityNotes".

The first day's plan must start no earlier than the traveler's arrival time, and the last day's plan must end in time for their departure. ${languageInstruction(
    locale
  )}

Respond with ONLY a single JSON object (no markdown fences, no commentary before or after) matching exactly this shape:
${ITINERARY_JSON_SHAPE}`;
}

function buildResearchSystemPrompt(locale: Locale): string {
  return `You are a travel research assistant building a reusable reference note about a destination. Use web_search to gather:
- Currently popular attractions and restaurants (consider Google Maps, TripAdvisor, and Yelp style ratings/reviews when reasoning)
- News from the last 1-2 years relevant to the destination (safety, closures, new attractions, events, festivals)
- Typical weather/seasons throughout the year
- Local customs, etiquette, and general safety notes

Write a concise but information-dense reference note (plain text, not JSON — short paragraphs or bullet points are fine) that another AI can use later to plan itineraries for this destination without searching again. Do not mention specific travel dates — this note must stay useful for travelers visiting at any time of year. ${languageInstruction(
    locale
  )}`;
}

/**
 * One-time (per destination+locale, until the cache expires) web-search-heavy
 * call that produces a reusable reference note. Callers should cache the
 * result (see destinationResearch.service.ts) instead of calling this on
 * every itinerary generation — that's what removes most of the repeated
 * search latency/cost from generateItinerary and chatRefine.
 */
export async function researchDestination(destination: string, locale: Locale): Promise<string> {
  const response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 1200,
    system: buildResearchSystemPrompt(locale),
    tools: [webSearchTool(RESEARCH_SEARCH_BUDGET)],
    messages: [{ role: "user", content: `Destination: ${destination}` }],
  });

  const text = collectText(response.content).trim();
  if (!text) {
    throw new Error("Claude returned an empty destination research note");
  }
  return text;
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Claude response did not contain a JSON array");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function collectText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Calls Claude expecting a JSON response. LLM output isn't guaranteed to be
 * syntactically valid JSON (a stray comma, an unescaped quote, etc.), so on a
 * parse failure this feeds the broken reply back and asks Claude to correct
 * it, up to MAX_ATTEMPTS total calls, instead of failing the whole request.
 */
interface CreateJsonMessageOptions {
  tools?: Tools;
  model?: string;
  // Marks the system prompt as reusable across calls (cache_control), which
  // only pays off once the system text is at least ~1024 tokens (e.g.
  // chatRefine's system prompt, which embeds the full current itinerary) —
  // Anthropic silently skips caching below that, so it's harmless to leave on.
  cacheSystem?: boolean;
}

async function createJsonMessage<T>(
  system: string,
  initialMessages: Anthropic.Messages.MessageParam[],
  maxTokens: number,
  extract: (text: string) => T,
  options: CreateJsonMessageOptions = {}
): Promise<T> {
  const { tools, model = env.anthropicModel, cacheSystem = false } = options;
  const MAX_ATTEMPTS = 3;
  let messages = initialMessages;
  let lastError: Error | undefined;

  const systemParam: Anthropic.Messages.MessageCreateParamsNonStreaming["system"] = cacheSystem
    ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
    : system;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemParam,
      tools,
      messages,
    });

    const text = collectText(response.content);
    try {
      return extract(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_ATTEMPTS) break;
      messages = [
        ...messages,
        { role: "assistant", content: response.content as unknown as Anthropic.Messages.ContentBlockParam[] },
        {
          role: "user",
          content:
            "That response was not valid JSON and failed to parse. Respond again with ONLY the corrected, complete, valid JSON — no markdown fences, no extra commentary.",
        },
      ];
    }
  }

  throw new Error(`Claude did not return valid JSON after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`);
}

export interface GenerateItineraryParams {
  destination: string;
  days: number;
  arrivalDate?: string;
  arrivalTime: string;
  departureDate?: string;
  departureTime: string;
  interests?: string[];
  mustSeeAttractions?: string[];
  mustEatRestaurants?: string[];
  travelStyle?: string;
  budget?: string;
  locale: Locale;
  researchContext: string;
}

export async function generateItinerary(
  params: GenerateItineraryParams
): Promise<ItineraryDraft> {
  const userPrompt = `Plan a ${params.days}-day trip to ${params.destination}.
${
  params.arrivalDate
    ? `Arrival: ${params.arrivalDate} at ${params.arrivalTime}`
    : `Arrival time each first day: ${params.arrivalTime} (no specific arrival date given — use relative day numbers)`
}
${
  params.departureDate
    ? `Departure: ${params.departureDate} at ${params.departureTime}`
    : `Departure time on the last day: ${params.departureTime}`
}
Interests / trip type: ${params.interests?.join(", ") || "no strong preference, suggest well-rounded popular options"}
Must-include attractions: ${params.mustSeeAttractions?.join(", ") || "none specified"}
Must-include restaurants/food: ${params.mustEatRestaurants?.join(", ") || "none specified"}
Travel style: ${params.travelStyle || "not specified"}
Budget: ${params.budget || "not specified"}

Use the pre-researched destination notes plus targeted date-specific search to build the plan.`;

  return createJsonMessage(
    buildSystemPrompt(params.locale, params.researchContext),
    [{ role: "user", content: userPrompt }],
    8000,
    (text) => {
      const parsed = extractJson(text) as ItineraryDraft;
      if (typeof parsed.destination !== "string" || !Array.isArray(parsed.days)) {
        throw new Error("Claude JSON response is missing required itinerary fields");
      }
      return parsed;
    },
    { tools: [webSearchTool(ITINERARY_SEARCH_BUDGET)] }
  );
}

export interface ChatRefineParams {
  currentItinerary: ItineraryDraft;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  locale: Locale;
  researchContext: string;
}

export interface ChatRefineResult {
  reply: string;
  isChangeRequest: boolean;
  updatedItinerary?: ItineraryDraft;
}

export async function chatRefine(params: ChatRefineParams): Promise<ChatRefineResult> {
  const system = `You are an AI travel planning assistant helping a user with an existing itinerary.
The current itinerary (JSON) is:
${JSON.stringify(params.currentItinerary, null, 2)}

Pre-researched notes about this destination (reuse these instead of re-searching general attractions/restaurants/customs):
"""
${params.researchContext}
"""

First decide whether the user's message is:
(a) a QUESTION — they just want information (e.g. "what's good to eat at XXX", "how's the weather in March") — answer it in "reply" and set "isChangeRequest" to false. Do NOT include "updatedItinerary".
(b) a CHANGE REQUEST — they want you to modify the itinerary (delete/replace/extend/reorder/add an item). Use web_search sparingly, only for something specific the notes above don't cover. Set "isChangeRequest" to true, put a short explanation of the proposed change in "reply", and include the FULL updated itinerary in "updatedItinerary" (this is only a proposal — it will not be applied unless the user confirms it).

Respond with ONLY a single JSON object (no markdown fences) of this shape:
{
  "reply": string,
  "isChangeRequest": boolean,
  "updatedItinerary": ${ITINERARY_JSON_SHAPE}  // omit entirely (or set to null) when isChangeRequest is false
}
${languageInstruction(params.locale)}`;

  const messages: Anthropic.Messages.MessageParam[] = [
    ...params.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: params.userMessage },
  ];

  const parsed = await createJsonMessage(
    system,
    messages,
    8000,
    (text) => {
      const result = extractJson(text) as ChatRefineResult & { updatedItinerary?: ItineraryDraft | null };
      if (typeof result.reply !== "string" || result.reply.length === 0) {
        throw new Error("Claude JSON response is missing the required 'reply' field");
      }
      return result;
    },
    { tools: [webSearchTool(CHAT_SEARCH_BUDGET)], cacheSystem: true }
  );

  return {
    reply: parsed.reply,
    isChangeRequest: Boolean(parsed.isChangeRequest && parsed.updatedItinerary),
    updatedItinerary: parsed.isChangeRequest && parsed.updatedItinerary ? parsed.updatedItinerary : undefined,
  };
}

export async function suggestInterests(destination: string, locale: Locale): Promise<string[]> {
  const system = `You suggest short trip-interest tags for a travel planner UI. Given a destination, respond with ONLY a JSON array of 5 to 10 short strings (2-4 words each) naming popular activity/interest categories specifically relevant to that destination (e.g. for a place with mountains: "hiking", "hot spring", "national park"; for a coastal city: "seafood", "beaches", "diving"). No markdown fences, no commentary. ${languageInstruction(
    locale
  )}`;

  const parsed = await createJsonMessage(
    system,
    [{ role: "user", content: `Destination: ${destination}` }],
    500,
    (text) => extractJsonArray(text),
    { model: env.anthropicFastModel }
  );
  return parsed.filter((v): v is string => typeof v === "string");
}

export interface QuickSuggestion {
  id: string;
  label: string;
  question: string;
}

export async function quickSuggestions(
  destination: string,
  days: number,
  locale: Locale,
  exclude: string[] = []
): Promise<QuickSuggestion[]> {
  const system = `You suggest 5 short "quick question" buttons for a trip-planning UI about a specific destination. Each has a short button "label" (a few words) and a fuller "question" that will be sent to a research assistant if clicked (e.g. label "鄰近城市" / question "What nearby cities or day-trip destinations are worth visiting from <destination>?"). Cover a useful variety: nearby cities/day trips, top-rated attractions (e.g. TripAdvisor-style), weather forecast/best season, local customs or etiquette, safety tips, packing tips, transportation options, must-try food, budget tips, etc. — pick 5 that are most useful for this destination.
${exclude.length > 0 ? `Do NOT repeat these previously shown labels: ${exclude.join(", ")}. Pick 5 different ones.` : ""}
Respond with ONLY a JSON array of exactly 5 objects: [{ "id": string, "label": string, "question": string }, ...]. No markdown fences, no commentary. ${languageInstruction(
    locale
  )}`;

  return createJsonMessage(
    system,
    [{ role: "user", content: `Destination: ${destination}, trip length: ${days} days` }],
    800,
    (text) => extractJsonArray(text) as QuickSuggestion[],
    { model: env.anthropicFastModel }
  );
}

export async function quickAnswer(
  destination: string,
  days: number,
  question: string,
  locale: Locale
): Promise<string> {
  const system = `You are a helpful travel research assistant. Use web_search to answer the user's question about their destination with current, accurate information. Keep the answer concise (a short paragraph or a short bullet list). ${languageInstruction(
    locale
  )}`;

  const response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 1200,
    system,
    tools: [webSearchTool(QUICK_ANSWER_SEARCH_BUDGET)],
    messages: [
      { role: "user", content: `Destination: ${destination}, trip length: ${days} days.\nQuestion: ${question}` },
    ],
  });

  return collectText(response.content).trim();
}
