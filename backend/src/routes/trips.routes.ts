import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  deleteItem,
  deleteTrip,
  getTrip,
  listTrips,
  renameTrip,
  updateItem,
} from "../controllers/trips.controller";

export const tripsRouter = Router();

tripsRouter.use(requireAuth);
tripsRouter.get("/", listTrips);
tripsRouter.get("/:id", getTrip);
tripsRouter.patch("/:id", renameTrip);
tripsRouter.delete("/:id", deleteTrip);
tripsRouter.patch("/:tripId/items/:itemId", updateItem);
tripsRouter.delete("/:tripId/items/:itemId", deleteItem);
