import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth } from "./auth";
import { signToken } from "../utils/jwt";
import { env } from "../config/env";
import { AuthRequest } from "../types";
import { Response } from "express";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing or invalid Authorization header" });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("rejects a request with a malformed Authorization header (no Bearer prefix)", () => {
    const req = { headers: { authorization: "Token abc123" } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid/garbage token", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a request with an expired token", () => {
    const expiredToken = jwt.sign({ userId: "u1", email: "a@example.com" }, env.jwtSecret, {
      expiresIn: -10, // already expired 10 seconds ago
    });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("populates req.user and calls next() for a valid token", () => {
    const token = signToken({ userId: "u1", email: "a@example.com" });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId: "u1", email: "a@example.com" });
    expect(res.status).not.toHaveBeenCalled();
  });
});
