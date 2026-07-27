import { prisma } from "../db/prisma";
import { Locale } from "../types";
import { researchDestination } from "./anthropic.service";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function normalizeDestination(destination: string): string {
  return destination.trim().toLowerCase();
}

/**
 * Returns a cached reference note for this destination if one exists and
 * hasn't expired, otherwise runs a fresh (web_search-heavy) research call
 * and caches the result. This is what lets repeat itinerary generations for
 * the same destination skip most of the live web_search round trips that
 * were making generation slow.
 */
export async function getDestinationResearch(destination: string, locale: Locale): Promise<string> {
  const key = normalizeDestination(destination);

  const cached = await prisma.destinationResearch.findUnique({
    where: { destination_locale: { destination: key, locale } },
  });

  if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS) {
    return cached.content;
  }

  const content = await researchDestination(destination, locale);

  await prisma.destinationResearch.upsert({
    where: { destination_locale: { destination: key, locale } },
    create: { destination: key, locale, content },
    update: { content },
  });

  return content;
}
