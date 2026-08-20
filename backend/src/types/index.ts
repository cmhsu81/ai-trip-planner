import { Request } from "express";
import { JwtPayload } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type Locale = "en" | "zh";

export type ItineraryItemType =
  | "attraction"
  | "restaurant"
  | "activity"
  | "transport"
  | "lodging";

export interface ItineraryItemDraft {
  time?: string;
  title: string;
  type: ItineraryItemType;
  description?: string;
  location?: string;
  estimatedDuration?: string;
  sourceNote?: string;
  imageUrl?: string;
}

export interface ItineraryDayDraft {
  day: number;
  date?: string;
  items: ItineraryItemDraft[];
}

export interface ItineraryDraft {
  destination: string;
  days: ItineraryDayDraft[];
  feasibilityNotes: string[];
  summary: string;
}
