// Pre-warms the DestinationResearch cache for a fixed list of popular
// destinations so the first real user request for one of them hits the
// cache instead of paying for a live, web_search-heavy research call.
// Run with: npx tsx src/scripts/prewarmDestinationResearch.ts
import { getDestinationResearch } from "../services/destinationResearch.service";
import { prisma } from "../db/prisma";
import { Locale } from "../types";

const DESTINATIONS = [
  "Tokyo, Japan",
  "Paris, France",
  "New York City, USA",
  "London, UK",
  "Bangkok, Thailand",
  "Rome, Italy",
  "Barcelona, Spain",
  "Seoul, South Korea",
  "Bali, Indonesia",
  "Singapore",
];

const LOCALES: Locale[] = ["en", "zh"];

async function main() {
  for (const destination of DESTINATIONS) {
    for (const locale of LOCALES) {
      const label = `${destination} (${locale})`;
      try {
        console.log(`Pre-warming ${label}...`);
        await getDestinationResearch(destination, locale);
        console.log(`  done: ${label}`);
      } catch (err) {
        console.error(`  failed: ${label} - ${(err as Error).message}`);
      }
    }
  }
}

main()
  .catch((err) => {
    console.error("Prewarm script crashed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
