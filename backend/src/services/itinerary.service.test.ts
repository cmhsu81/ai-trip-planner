import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    itineraryDay: { deleteMany: vi.fn(), create: vi.fn() },
    itineraryItem: { create: vi.fn() },
    trip: { update: vi.fn() },
  },
}));

import { prisma } from "../db/prisma";
import { replaceTripItinerary, tripToDraft } from "./itinerary.service";
import { ItineraryDraft } from "../types";

const deleteMany = prisma.itineraryDay.deleteMany as unknown as ReturnType<typeof vi.fn>;
const dayCreate = prisma.itineraryDay.create as unknown as ReturnType<typeof vi.fn>;
const itemCreate = prisma.itineraryItem.create as unknown as ReturnType<typeof vi.fn>;
const tripUpdate = prisma.trip.update as unknown as ReturnType<typeof vi.fn>;
const transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

describe("replaceTripItinerary", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    dayCreate.mockReset();
    itemCreate.mockReset();
    tripUpdate.mockReset();
    transaction.mockReset();

    // Run the callback with a tx object backed by the same mocks, like a real transaction would.
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        itineraryDay: { deleteMany, create: dayCreate },
        itineraryItem: { create: itemCreate },
        trip: { update: tripUpdate },
      })
    );

    dayCreate.mockResolvedValue({ id: "day-1" });
    itemCreate.mockResolvedValue({});
    tripUpdate.mockResolvedValue({});
  });

  it("passes imageUrl through to itineraryItem.create", async () => {
    const draft: ItineraryDraft = {
      destination: "Tokyo",
      summary: "A great trip",
      feasibilityNotes: [],
      days: [
        {
          day: 1,
          items: [
            {
              title: "Visit the shrine",
              type: "attraction",
              imageUrl: "https://example.com/shrine.jpg",
            },
          ],
        },
      ],
    };

    await replaceTripItinerary("trip-1", draft);

    expect(itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageUrl: "https://example.com/shrine.jpg" }),
    });
  });

  it("passes undefined imageUrl through when the item has none", async () => {
    const draft: ItineraryDraft = {
      destination: "Tokyo",
      summary: "",
      feasibilityNotes: [],
      days: [
        {
          day: 1,
          items: [{ title: "Walk around", type: "activity" }],
        },
      ],
    };

    await replaceTripItinerary("trip-1", draft);

    expect(itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageUrl: undefined }),
    });
  });
});

describe("tripToDraft", () => {
  function buildTrip(itemOverrides: Record<string, unknown>) {
    return {
      id: "trip-1",
      userId: "user-1",
      title: "Tokyo Trip",
      destination: "Tokyo",
      days: 1,
      arrivalDate: null,
      departureDate: null,
      notes: "notes",
      createdAt: new Date(),
      chatMessages: [],
      itineraryDays: [
        {
          id: "day-1",
          dayNumber: 1,
          date: null,
          items: [
            {
              id: "item-1",
              time: null,
              title: "Visit the shrine",
              type: "attraction",
              description: null,
              location: null,
              estimatedDuration: null,
              sourceNote: null,
              orderIndex: 0,
              imageUrl: null,
              ...itemOverrides,
            },
          ],
        },
      ],
    };
  }

  it("maps a DB item's imageUrl back to the draft shape", () => {
    const trip = buildTrip({ imageUrl: "https://example.com/shrine.jpg" });

    const draft = tripToDraft(trip as unknown as Parameters<typeof tripToDraft>[0]);

    expect(draft.days[0].items[0].imageUrl).toBe("https://example.com/shrine.jpg");
  });

  it("maps a null imageUrl to undefined in the draft shape", () => {
    const trip = buildTrip({ imageUrl: null });

    const draft = tripToDraft(trip as unknown as Parameters<typeof tripToDraft>[0]);

    expect(draft.days[0].items[0].imageUrl).toBeUndefined();
  });
});
