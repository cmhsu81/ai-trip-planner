export type Locale = "en" | "zh";

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
  imageUrl: string | null;
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

// A chat message as rendered in the UI: persisted messages plus, for a
// pending assistant reply that proposed a change, the not-yet-applied draft
// and whether the user has resolved it yet.
export interface DisplayChatMessage extends ChatMessage {
  isChangeRequest?: boolean;
  proposedItinerary?: ItineraryDraft | null;
  resolution?: "applied" | "dismissed";
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  days: number;
  arrivalDate: string | null;
  arrivalTime: string;
  departureDate: string | null;
  departureTime: string;
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
  arrivalDate: string | null;
  departureDate: string | null;
  createdAt: string;
}

export interface GenerateTripInput {
  title?: string;
  destination: string;
  days: number;
  arrivalDate?: string;
  arrivalTime: string;
  departureDate?: string;
  departureTime: string;
  interests?: string[];
  mustSeeAttractions?: string[];
  mustEatRestaurants?: string[];
  travelStyle?: string;
  budget?: string;
  locale: Locale;
}

// Mirrors the backend's ItineraryDraft shape (the AI's raw proposal, before
// it's persisted as ItineraryDay/ItineraryItem rows).
export interface ItineraryDraftItem {
  time?: string;
  title: string;
  type: ItineraryItemType;
  description?: string;
  location?: string;
  estimatedDuration?: string;
  sourceNote?: string;
  imageUrl?: string;
}

export interface ItineraryDraftDay {
  day: number;
  date?: string;
  items: ItineraryDraftItem[];
}

export interface ItineraryDraft {
  destination: string;
  summary: string;
  feasibilityNotes: string[];
  days: ItineraryDraftDay[];
}

export interface QuickSuggestion {
  id: string;
  label: string;
  question: string;
}
