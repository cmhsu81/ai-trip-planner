import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/prisma", () => ({
  prisma: {
    destinationResearch: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("./anthropic.service", () => ({
  researchDestination: vi.fn(),
}));

import { prisma } from "../db/prisma";
import { researchDestination } from "./anthropic.service";
import { getDestinationResearch } from "./destinationResearch.service";

const findUnique = prisma.destinationResearch.findUnique as unknown as ReturnType<typeof vi.fn>;
const upsert = prisma.destinationResearch.upsert as unknown as ReturnType<typeof vi.fn>;
const mockResearchDestination = researchDestination as unknown as ReturnType<typeof vi.fn>;

describe("getDestinationResearch", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    mockResearchDestination.mockReset();
  });

  it("returns cached content on a fresh cache hit without calling researchDestination", async () => {
    findUnique.mockResolvedValue({
      content: "cached Tokyo notes",
      updatedAt: new Date(), // just now, well within the 14-day TTL
    });

    const result = await getDestinationResearch("Tokyo", "en");

    expect(result).toBe("cached Tokyo notes");
    expect(mockResearchDestination).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("normalizes destination (trim + lowercase) when looking up the cache key", async () => {
    findUnique.mockResolvedValue({ content: "cached", updatedAt: new Date() });

    await getDestinationResearch("  Tokyo  ", "en");

    expect(findUnique).toHaveBeenCalledWith({
      where: { destination_locale: { destination: "tokyo", locale: "en" } },
    });
  });

  it("calls researchDestination and upserts when there is no cache entry", async () => {
    findUnique.mockResolvedValue(null);
    mockResearchDestination.mockResolvedValue("fresh notes");
    upsert.mockResolvedValue({});

    const result = await getDestinationResearch("Paris", "en");

    expect(result).toBe("fresh notes");
    expect(mockResearchDestination).toHaveBeenCalledWith("Paris", "en");
    expect(upsert).toHaveBeenCalledWith({
      where: { destination_locale: { destination: "paris", locale: "en" } },
      create: { destination: "paris", locale: "en", content: "fresh notes" },
      update: { content: "fresh notes" },
    });
  });

  it("calls researchDestination and upserts when the cache entry is older than the 14-day TTL", async () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ content: "stale notes", updatedAt: fifteenDaysAgo });
    mockResearchDestination.mockResolvedValue("refreshed notes");
    upsert.mockResolvedValue({});

    const result = await getDestinationResearch("Paris", "en");

    expect(result).toBe("refreshed notes");
    expect(mockResearchDestination).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("still returns cached content when the entry is just under the TTL boundary", async () => {
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ content: "still fresh", updatedAt: thirteenDaysAgo });

    const result = await getDestinationResearch("Paris", "en");

    expect(result).toBe("still fresh");
    expect(mockResearchDestination).not.toHaveBeenCalled();
  });
});
