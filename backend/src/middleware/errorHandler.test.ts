import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ApiError, errorHandler } from "./errorHandler";

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("uses ApiError's own status and message", () => {
    const res = mockRes();
    errorHandler(new ApiError(404, "Trip not found"), {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Trip not found" });
  });

  it("maps a P2003 foreign key violation to a 401 'log in again' response", () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
      code: "P2003",
      clientVersion: "5.22.0",
    });
    errorHandler(err, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Your session refers to an account that no longer exists. Please log in again.",
    });
  });

  it("does not special-case other Prisma error codes — falls through to a generic 500", () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "5.22.0",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorHandler(err, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });

  it("logs and returns a generic 500 for an unrecognized error", () => {
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorHandler(new Error("boom"), {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
