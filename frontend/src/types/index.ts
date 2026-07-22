export type ItineraryItemType =
  | "attraction"
  | "restaurant"
  | "activity"
  | "transport"
  | "lodging";

export interface ItineraryItem {
  id: string;
  time: string | null;
  title: string;
  type: ItineraryItemType;
  description: string | null;
  location: string | null;
  estimatedDuration: string | null;
  sourceNote: string | null;
  confirmed: boolean;
  orderIndex: number;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string | null;
  items: ItineraryItem[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  days: number;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
  itineraryDays?: ItineraryDay[];
  chatMessages?: ChatMessage[];
}

export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  days: number;
  startDate: string | null;
  createdAt: string;
}

export interface GenerateTripInput {
  title?: string;
  destination: string;
  days: number;
  startDate?: string;
  interests?: string[];
  mustSeeAttractions?: string[];
  mustEatRestaurants?: string[];
  travelStyle?: string;
  budget?: string;
}
