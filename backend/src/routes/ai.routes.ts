import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { chat, generate } from "../controllers/ai.controller";

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post("/generate", generate);
aiRouter.post("/chat", chat);
