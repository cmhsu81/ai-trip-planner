import { prisma } from "../db/prisma";
import { ItineraryDraft } from "../types";

export async function replaceTripItinerary(tripId: string, draft: ItineraryDraft) {
  await prisma.$transaction(async (tx) => {
    await tx.itineraryDay.deleteMany({ where: { tripId } });

    await tx.trip.update({
      where: { id: tripId },
      data: { notes: draft.summary },
    });

    for (const day of draft.days) {
      const createdDay = await tx.itineraryDay.create({
        data: {
          tripId,
          dayNumber: day.day,
          date: day.date ? new Date(day.date) : null,
        },
      });

      for (const [index, item] of day.items.entries()) {
        await tx.itineraryItem.create({
          data: {
            itineraryDayId: createdDay.id,
            orderIndex: index,
            time: item.time,
            title: item.title,
            type: item.type,
            description: item.description,
            location: item.location,
            estimatedDuration: item.estimatedDuration,
            sourceNote: item.sourceNote,
          },
        });
      }
    }
  });
}

export async function getTripWithItinerary(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { orderIndex: "asc" } } },
      },
      chatMessages: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function tripToDraft(
  trip: NonNullable<Awaited<ReturnType<typeof getTripWithItinerary>>>
): ItineraryDraft {
  return {
    destination: trip.destination,
    summary: trip.notes ?? "",
    feasibilityNotes: [],
    days: trip.itineraryDays.map((day) => ({
      day: day.dayNumber,
      date: day.date ? day.date.toISOString().slice(0, 10) : undefined,
      items: day.items.map((item) => ({
        time: item.time ?? undefined,
        title: item.title,
        type: item.type as ItemType,
        description: item.description ?? undefined,
        location: item.location ?? undefined,
        estimatedDuration: item.estimatedDuration ?? undefined,
        sourceNote: item.sourceNote ?? undefined,
      })),
    })),
  };
}

type ItemType = ItineraryDraft["days"][number]["items"][number]["type"];
