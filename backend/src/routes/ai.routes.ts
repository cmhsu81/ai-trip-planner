import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  chat,
  chatApply,
  generate,
  quickAnswerHandler,
  quickSuggestionsHandler,
  suggestInterestsHandler,
} from "../controllers/ai.controller";

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post("/generate", generate);
aiRouter.post("/chat", chat);
aiRouter.post("/chat/apply", chatApply);
aiRouter.post("/suggest-interests", suggestInterestsHandler);
aiRouter.post("/quick-suggestions", quickSuggestionsHandler);
aiRouter.post("/quick-answer", quickAnswerHandler);
