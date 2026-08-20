import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    trip: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itineraryItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "../db/prisma";
import { app } from "../app";
import { signToken } from "../utils/jwt";

const tripFindFirst = prisma.trip.findFirst as unknown as ReturnType<typeof vi.fn>;
const tripUpdate = prisma.trip.update as unknown as ReturnType<typeof vi.fn>;
const tripDelete = prisma.trip.delete as unknown as ReturnType<typeof vi.fn>;
const itemFindFirst = prisma.itineraryItem.findFirst as unknown as ReturnType<typeof vi.fn>;
const itemUpdate = prisma.itineraryItem.update as unknown as ReturnType<typeof vi.fn>;
const itemDelete = prisma.itineraryItem.delete as unknown as ReturnType<typeof vi.fn>;

const OWNER_ID = "user-owner";
const ATTACKER_ID = "user-attacker";
const ownerToken = signToken({ userId: OWNER_ID, email: "owner@example.com" });
const attackerToken = signToken({ userId: ATTACKER_ID, email: "attacker@example.com" });

// Simulates a real Postgres row: only findable when the where clause's
// userId actually matches, just like `prisma.trip.findFirst({ where: { id, userId } })`.
const trip = {
  id: "trip-1",
  userId: OWNER_ID,
  title: "Tokyo Trip",
  destination: "Tokyo",
  days: 3,
  arrivalDate: null,
  departureDate: null,
  notes: null,
  createdAt: new Date(),
  itineraryDays: [],
  chatMessages: [],
};

const item = {
  id: "item-1",
  itineraryDay: {
    tripId: "trip-1",
    trip: { userId: OWNER_ID },
  },
};

describe("trip ownership enforcement", () => {
  beforeEach(() => {
    tripFindFirst.mockReset();
    tripUpdate.mockReset();
    tripDelete.mockReset();
    itemFindFirst.mockReset();
    itemUpdate.mockReset();
    itemDelete.mockReset();

    tripFindFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      if (where.id === trip.id && where.userId === trip.userId) return trip;
      return null;
    });
    itemFindFirst.mockImplementation(
      async ({ where }: { where: { id: string; itineraryDay: { tripId: string } } }) => {
        if (where.id === item.id && where.itineraryDay.tripId === item.itineraryDay.tripId) {
          return item;
        }
        return null;
      }
    );
  });

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(app).get("/api/trips/trip-1");
    expect(res.status).toBe(401);
  });

  it("lets the owner read their own trip", async () => {
    const res = await request(app)
      .get("/api/trips/trip-1")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.id).toBe("trip-1");
  });

  it("returns 404 (not another user's trip data) when a different user requests it", async () => {
    const res = await request(app)
      .get("/api/trips/trip-1")
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/trip not found/i);
  });

  it("prevents a non-owner from renaming another user's trip", async () => {
    const res = await request(app)
      .patch("/api/trips/trip-1")
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ title: "Hijacked title" });

    expect(res.status).toBe(404);
    expect(tripUpdate).not.toHaveBeenCalled();
  });

  it("allows the owner to rename their own trip", async () => {
    tripUpdate.mockResolvedValue({ ...trip, title: "New title" });

    const res = await request(app)
      .patch("/api/trips/trip-1")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "New title" });

    expect(res.status).toBe(200);
    expect(tripUpdate).toHaveBeenCalledWith({ where: { id: "trip-1" }, data: { title: "New title" } });
  });

  it("prevents a non-owner from deleting another user's trip", async () => {
    const res = await request(app)
      .delete("/api/trips/trip-1")
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(tripDelete).not.toHaveBeenCalled();
  });

  it("allows the owner to delete their own trip", async () => {
    tripDelete.mockResolvedValue({});

    const res = await request(app)
      .delete("/api/trips/trip-1")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
    expect(tripDelete).toHaveBeenCalledWith({ where: { id: "trip-1" } });
  });

  it("prevents a non-owner from deleting another user's itinerary item, even though the item query itself isn't userId-scoped", async () => {
    const res = await request(app)
      .delete("/api/trips/trip-1/items/item-1")
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/itinerary item not found/i);
    expect(itemDelete).not.toHaveBeenCalled();
  });

  it("allows the owner to delete their own itinerary item", async () => {
    itemDelete.mockResolvedValue({});

    const res = await request(app)
      .delete("/api/trips/trip-1/items/item-1")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
    expect(itemDelete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });

  it("prevents a non-owner from updating another user's itinerary item", async () => {
    const res = await request(app)
      .patch("/api/trips/trip-1/items/item-1")
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(404);
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it("accepts an imageUrl in the PATCH body and passes it through to prisma.itineraryItem.update", async () => {
    itemUpdate.mockResolvedValue({ ...item, imageUrl: "https://example.com/photo.jpg" });

    const res = await request(app)
      .patch("/api/trips/trip-1/items/item-1")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ imageUrl: "https://example.com/photo.jpg" });

    expect(res.status).toBe(200);
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { imageUrl: "https://example.com/photo.jpg" },
    });
  });
});
