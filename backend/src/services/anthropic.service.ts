import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { ItineraryDraft } from "../types";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 8,
};

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

function buildSystemPrompt(): string {
  return `You are an expert AI travel planner. You have access to a web_search tool — use it to look up:
- Currently popular attractions and restaurants (consider Google Maps, TripAdvisor, and Yelp style ratings/reviews when reasoning)
- News from the last 1-2 years relevant to the destination (safety, closures, new attractions, events, festivals)
- Expected weather/season conditions for the travel dates
- Local events or holidays that could affect the plan

Use search results to ground your recommendations in current, real information rather than guessing. Judge feasibility: flag anything unrealistic (too many stops in one day, conflicting travel times, seasonal closures, extreme weather) inside "feasibilityNotes".

After researching, respond with ONLY a single JSON object (no markdown fences, no commentary before or after) matching exactly this shape:
${ITINERARY_JSON_SHAPE}`;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function collectText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export interface GenerateItineraryParams {
  destination: string;
  days: number;
  startDate?: string;
  interests?: string[];
  mustSeeAttractions?: string[];
  mustEatRestaurants?: string[];
  travelStyle?: string;
  budget?: string;
}

export async function generateItinerary(
  params: GenerateItineraryParams
): Promise<ItineraryDraft> {
  const userPrompt = `Plan a ${params.days}-day trip to ${params.destination}.
${params.startDate ? `Start date: ${params.startDate}` : "No specific start date given — use relative day numbers."}
Interests / trip type: ${params.interests?.join(", ") || "no strong preference, suggest well-rounded popular options"}
Must-include attractions: ${params.mustSeeAttractions?.join(", ") || "none specified"}
Must-include restaurants/food: ${params.mustEatRestaurants?.join(", ") || "none specified"}
Travel style: ${params.travelStyle || "not specified"}
Budget: ${params.budget || "not specified"}

Research current top-rated attractions/restaurants and recent (last 1-2 years) relevant news, weather patterns, and local events for this destination before building the plan.`;

  const response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 8000,
    system: buildSystemPrompt(),
    tools: [WEB_SEARCH_TOOL],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = collectText(response.content);
  const parsed = extractJson(text) as ItineraryDraft;
  return parsed;
}

export interface ChatRefineParams {
  currentItinerary: ItineraryDraft;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}

export interface ChatRefineResult {
  reply: string;
  updatedItinerary: ItineraryDraft;
}

export async function chatRefine(params: ChatRefineParams): Promise<ChatRefineResult> {
  const system = `You are an AI travel planning assistant helping a user refine an existing itinerary.
The current itinerary (JSON) is:
${JSON.stringify(params.currentItinerary, null, 2)}

The user may ask you to delete an item, replace an item with an alternative (use web_search if you need fresh recommendations), extend/shorten time spent somewhere, reorder the day, or add something new. Use web_search when the request needs current information (e.g. "find another restaurant nearby", "what's a good rainy-day alternative").

Respond with ONLY a single JSON object (no markdown fences) of this shape:
{
  "reply": string,              // a short conversational reply explaining what you changed, in the same language the user wrote in
  "updatedItinerary": ${ITINERARY_JSON_SHAPE}
}
If nothing about the itinerary needs to change, return "updatedItinerary" unchanged.`;

  const messages: Anthropic.Messages.MessageParam[] = [
    ...params.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: params.userMessage },
  ];

  const response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 8000,
    system,
    tools: [WEB_SEARCH_TOOL],
    messages,
  });

  const text = collectText(response.content);
  const parsed = extractJson(text) as ChatRefineResult;
  return parsed;
}
