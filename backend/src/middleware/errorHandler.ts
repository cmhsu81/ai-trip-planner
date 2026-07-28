import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  // requireAuth only checks the JWT signature, not whether that user still
  // exists — a valid-looking token can outlive the account it names (e.g.
  // the DB got reset/reseeded while the browser still holds an old token).
  // Every foreign key in this schema chains back to userId, so in practice
  // a P2003 here means "this session refers to an account that's gone."
  // Surface it as an auth problem instead of a raw DB crash.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
    return res
      .status(401)
      .json({ error: "Your session refers to an account that no longer exists. Please log in again." });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
