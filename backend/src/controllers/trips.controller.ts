import { Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { AuthRequest } from "../types";
import { ApiError } from "../middleware/errorHandler";
import { getTripWithItinerary } from "../services/itinerary.service";

export async function listTrips(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const trips = await prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        destination: true,
        days: true,
        arrivalDate: true,
        departureDate: true,
        createdAt: true,
      },
    });
    res.json({ trips });
  } catch (err) {
    next(err);
  }
}

export async function getTrip(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const trip = await getTripWithItinerary(req.params.id, userId);
    if (!trip) throw new ApiError(404, "Trip not found");
    res.json({ trip });
  } catch (err) {
    next(err);
  }
}

const renameSchema = z.object({ title: z.string().min(1) });

export async function renameTrip(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { title } = renameSchema.parse(req.body);

    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) throw new ApiError(404, "Trip not found");

    const updated = await prisma.trip.update({ where: { id: trip.id }, data: { title } });
    res.json({ trip: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteTrip(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) throw new ApiError(404, "Trip not found");

    await prisma.trip.delete({ where: { id: trip.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function assertItemOwnership(tripId: string, itemId: string, userId: string) {
  const item = await prisma.itineraryItem.findFirst({
    where: { id: itemId, itineraryDay: { tripId } },
    include: { itineraryDay: { include: { trip: true } } },
  });
  if (!item || item.itineraryDay.trip.userId !== userId) {
    throw new ApiError(404, "Itinerary item not found");
  }
  return item;
}

export async function deleteItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { tripId, itemId } = req.params;
    await assertItemOwnership(tripId, itemId, req.user!.userId);
    await prisma.itineraryItem.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const updateItemSchema = z.object({
  title: z.string().min(1).optional(),
  time: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  estimatedDuration: z.string().optional(),
  imageUrl: z.string().optional(),
  type: z.enum(["attraction", "restaurant", "activity", "transport", "lodging"]).optional(),
  confirmed: z.boolean().optional(),
});

export async function updateItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { tripId, itemId } = req.params;
    await assertItemOwnership(tripId, itemId, req.user!.userId);
    const data = updateItemSchema.parse(req.body);

    const updated = await prisma.itineraryItem.update({ where: { id: itemId }, data });
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
}
