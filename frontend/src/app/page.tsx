"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api, ApiError } from "@/lib/api";
import { PlannerForm } from "@/components/PlannerForm";
import { ItineraryView } from "@/components/ItineraryView";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatMessage, GenerateTripInput, ItineraryDay, ItineraryItem, Trip } from "@/types";

interface GenerateResponse {
  trip: Trip;
  feasibilityNotes: string[];
}

interface ChatResponse {
  reply: string;
  trip: Trip;
}

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [feasibilityNotes, setFeasibilityNotes] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | undefined>(undefined);

  async function handleGenerate(input: GenerateTripInput) {
    if (!user) {
      router.push("/login");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<GenerateResponse>("/ai/generate", input);
      setTrip(data.trip);
      setItineraryDays(data.trip.itineraryDays ?? []);
      setFeasibilityNotes(data.feasibilityNotes ?? []);
      setMessages(data.trip.chatMessages ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendChat(message: string) {
    if (!trip) return;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    const data = await api.post<ChatResponse>("/ai/chat", { tripId: trip.id, message });
    setTrip(data.trip);
    setItineraryDays(data.trip.itineraryDays ?? []);
    setMessages(data.trip.chatMessages ?? []);
    setPendingChatMessage(undefined);
  }

  function handleAskAiToReplace(item: ItineraryItem, dayNumber: number) {
    setPendingChatMessage(
      `Please replace "${item.title}" on day ${dayNumber} with a good alternative.`
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("planner.title")}</h1>
        <p className="text-slate-500 mt-1">{t("planner.subtitle")}</p>
      </div>

      <PlannerForm onSubmit={handleGenerate} submitting={submitting} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {feasibilityNotes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800 mb-2">{t("planner.feasibility")}</h3>
          <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
            {feasibilityNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {trip && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ItineraryView
            tripId={trip.id}
            itineraryDays={itineraryDays}
            onChange={setItineraryDays}
            onAskAiToReplace={handleAskAiToReplace}
          />
          <ChatPanel
            messages={messages}
            onSend={handleSendChat}
            pendingMessage={pendingChatMessage}
          />
        </div>
      )}
    </div>
  );
}
