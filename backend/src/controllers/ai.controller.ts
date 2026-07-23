import { Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { AuthRequest, ItineraryDraft } from "../types";
import { ApiError } from "../middleware/errorHandler";
import {
  chatRefine,
  generateItinerary,
  quickAnswer,
  quickSuggestions,
  suggestInterests,
} from "../services/anthropic.service";
import { getTripWithItinerary, replaceTripItinerary, tripToDraft } from "../services/itinerary.service";

const localeSchema = z.enum(["en", "zh"]).default("zh");

const generateSchema = z.object({
  title: z.string().min(1).optional(),
  destination: z.string().min(1),
  days: z.number().int().min(1).max(30),
  arrivalDate: z.string().optional(),
  arrivalTime: z.string().default("10:00"),
  departureDate: z.string().optional(),
  departureTime: z.string().default("18:00"),
  interests: z.array(z.string()).optional(),
  mustSeeAttractions: z.array(z.string()).optional(),
  mustEatRestaurants: z.array(z.string()).optional(),
  travelStyle: z.string().optional(),
  budget: z.string().optional(),
  locale: localeSchema,
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
        arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
        arrivalTime: input.arrivalTime,
        departureDate: input.departureDate ? new Date(input.departureDate) : null,
        departureTime: input.departureTime,
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
  locale: localeSchema,
});

export async function chat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { tripId, message, locale } = chatSchema.parse(req.body);

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
      locale,
    });

    await prisma.chatMessage.create({ data: { tripId, role: "user", content: message } });
    const savedReply = await prisma.chatMessage.create({
      data: { tripId, role: "assistant", content: result.reply },
    });

    res.json({
      messageId: savedReply.id,
      reply: result.reply,
      isChangeRequest: result.isChangeRequest,
      proposedItinerary: result.updatedItinerary ?? null,
    });
  } catch (err) {
    next(err);
  }
}

const chatApplySchema = z.object({
  tripId: z.string().uuid(),
  proposedItinerary: z.custom<ItineraryDraft>((v) => typeof v === "object" && v !== null),
});

export async function chatApply(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { tripId, proposedItinerary } = chatApplySchema.parse(req.body);

    const trip = await getTripWithItinerary(tripId, userId);
    if (!trip) {
      throw new ApiError(404, "Trip not found");
    }

    await replaceTripItinerary(tripId, proposedItinerary);

    const full = await getTripWithItinerary(tripId, userId);
    res.json({ trip: full });
  } catch (err) {
    next(err);
  }
}

const suggestInterestsSchema = z.object({
  destination: z.string().min(1),
  locale: localeSchema,
});

export async function suggestInterestsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { destination, locale } = suggestInterestsSchema.parse(req.body);
    const suggestions = await suggestInterests(destination, locale);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
}

const quickSuggestionsSchema = z.object({
  destination: z.string().min(1),
  days: z.number().int().min(1).max(30),
  locale: localeSchema,
  exclude: z.array(z.string()).optional(),
});

export async function quickSuggestionsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { destination, days, locale, exclude } = quickSuggestionsSchema.parse(req.body);
    const suggestions = await quickSuggestions(destination, days, locale, exclude ?? []);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
}

const quickAnswerSchema = z.object({
  destination: z.string().min(1),
  days: z.number().int().min(1).max(30),
  question: z.string().min(1),
  locale: localeSchema,
});

export async function quickAnswerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { destination, days, question, locale } = quickAnswerSchema.parse(req.body);
    const answer = await quickAnswer(destination, days, question, locale);
    res.json({ answer });
  } catch (err) {
    next(err);
  }
}
