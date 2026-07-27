import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

vi.mock("../db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    trip: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    itineraryItem: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from "../db/prisma";
import { app } from "../app";

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const create = prisma.user.create as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it("registers a new user, hashing the password before storage", async () => {
    findUnique.mockResolvedValue(null);
    create.mockImplementation(async ({ data }: { data: { email: string; passwordHash: string } }) => ({
      id: "user-1",
      email: data.email,
      passwordHash: data.passwordHash,
    }));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: "user-1", email: "new@example.com" });

    const storedHash = create.mock.calls[0][0].data.passwordHash;
    expect(storedHash).not.toBe("password123");
    expect(await bcrypt.compare("password123", storedHash)).toBe(true);
  });

  it("rejects registration with a duplicate email", async () => {
    findUnique.mockResolvedValue({ id: "existing", email: "dup@example.com", passwordHash: "x" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects registration with an invalid payload (short password)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "short" });

    expect(res.status).toBe(500); // zod errors fall through to the generic error handler
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it("logs in with the correct password", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 10);
    findUnique.mockResolvedValue({ id: "user-1", email: "a@example.com", passwordHash });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: "user-1", email: "a@example.com" });
  });

  it("rejects login with the wrong password", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 10);
    findUnique.mockResolvedValue({ id: "user-1", email: "a@example.com", passwordHash });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it("rejects login for an unknown email", async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });
});
