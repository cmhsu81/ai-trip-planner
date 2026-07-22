import { Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { AuthRequest } from "../types";
import { ApiError } from "../middleware/errorHandler";
import { chatRefine, generateItinerary } from "../services/anthropic.service";
import { getTripWithItinerary, replaceTripItinerary, tripToDraft } from "../services/itinerary.service";

const generateSchema = z.object({
  title: z.string().min(1).optional(),
  destination: z.string().min(1),
  days: z.number().int().min(1).max(30),
  startDate: z.string().optional(),
  interests: z.array(z.string()).optional(),
  mustSeeAttractions: z.array(z.string()).optional(),
  mustEatRestaurants: z.array(z.string()).optional(),
  travelStyle: z.string().optional(),
  budget: z.string().optional(),
});

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const input = generateSchema.parse(req.body);

    const draft = await generateItinerary(input);

    const trip = await prisma.trip.create({
      data: {
        userId,
        title: input.title || `${input.destination} (${input.days} days)`,
        destination: input.destination,
        days: input.days,
        startDate: input.startDate ? new Date(input.startDate) : null,
        preferences: input,
        notes: draft.summary,
      },
    });

    await replaceTripItinerary(trip.id, draft);

    const full = await getTripWithItinerary(trip.id, userId);
    res.status(201).json({ trip: full, feasibilityNotes: draft.feasibilityNotes });
  } catch (err) {
    next(err);
  }
}

const chatSchema = z.object({
  tripId: z.string().uuid(),
  message: z.string().min(1),
});

export async function chat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { tripId, message } = chatSchema.parse(req.body);

    const trip = await getTripWithItinerary(tripId, userId);
    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    const conversationHistory = trip.chatMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const currentDraft = tripToDraft(trip);
    const result = await chatRefine({
      currentItinerary: currentDraft,
      conversationHistory,
      userMessage: message,
    });

    await prisma.chatMessage.create({ data: { tripId, role: "user", content: message } });
    await prisma.chatMessage.create({
      data: { tripId, role: "assistant", content: result.reply },
    });

    await replaceTripItinerary(tripId, result.updatedItinerary);

    const full = await getTripWithItinerary(tripId, userId);
    res.json({ reply: result.reply, trip: full });
  } catch (err) {
    next(err);
  }
}
