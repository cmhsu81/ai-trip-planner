import { ItineraryDraft } from "../types";

const USER_AGENT = "ai-trip-planner (https://github.com/cmhsu81/ai-trip-planner)";

/**
 * Looks up a representative photo for a well-known place via Wikipedia's
 * search + pageimages API (no API key required). Combining the item title
 * with the destination disambiguates generically-named places (e.g. "Central
 * Park") from same-named places elsewhere. Best-effort: returns null on any
 * miss or failure rather than throwing, since a missing image should never
 * break itinerary generation.
 */
async function fetchWikipediaImage(query: string): Promise<string | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    gsrnamespace: "0",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "500",
    format: "json",
    origin: "*",
  }).toString();

  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Fills in "imageUrl" for attraction items (the type most likely to be a
 * well-known landmark with a Wikipedia page) using a live Wikipedia lookup.
 * Restaurants, transport, lodging, and generic activities are skipped —
 * Wikipedia rarely has a page for them, so it's not worth the request.
 * Runs lookups in parallel; mutates nothing, returns a new draft.
 */
export async function enrichAttractionImages(draft: ItineraryDraft): Promise<ItineraryDraft> {
  const days = await Promise.all(
    draft.days.map(async (day) => {
      const items = await Promise.all(
        day.items.map(async (item) => {
          if (item.type !== "attraction" || item.imageUrl) return item;
          const imageUrl = await fetchWikipediaImage(`${item.title} ${draft.destination}`);
          return imageUrl ? { ...item, imageUrl } : item;
        })
      );
      return { ...day, items };
    })
  );

  return { ...draft, days };
}
