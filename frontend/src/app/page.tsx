"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api, ApiError } from "@/lib/api";
import { PlannerForm } from "@/components/PlannerForm";
import { ItineraryView } from "@/components/ItineraryView";
import { ChatPanel } from "@/components/ChatPanel";
import { AiSuggestions } from "@/components/AiSuggestions";
import { LandingPage } from "@/components/LandingPage";
import {
  DisplayChatMessage,
  GenerateTripInput,
  ItineraryDay,
  ItineraryDraft,
  ItineraryItem,
  Trip,
} from "@/types";

interface GenerateResponse {
  trip: Trip;
  feasibilityNotes: string[];
}

interface ChatResponse {
  messageId: string;
  reply: string;
  isChangeRequest: boolean;
  proposedItinerary: ItineraryDraft | null;
}

interface ChatApplyResponse {
  trip: Trip;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLocale();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [feasibilityNotes, setFeasibilityNotes] = useState<string[]>([]);
  const [messages, setMessages] = useState<DisplayChatMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | undefined>(undefined);
  const [formDestination, setFormDestination] = useState("");
  const [formDays, setFormDays] = useState(3);

  async function handleGenerate(input: GenerateTripInput) {
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
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);
    const data = await api.post<ChatResponse>("/ai/chat", {
      tripId: trip.id,
      message,
      locale,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: data.messageId,
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
        isChangeRequest: data.isChangeRequest,
        proposedItinerary: data.proposedItinerary,
      },
    ]);
    setPendingChatMessage(undefined);
  }

  async function handleAcceptChange(message: DisplayChatMessage) {
    if (!trip || !message.proposedItinerary) return;
    const data = await api.post<ChatApplyResponse>("/ai/chat/apply", {
      tripId: trip.id,
      proposedItinerary: message.proposedItinerary,
    });
    setTrip(data.trip);
    setItineraryDays(data.trip.itineraryDays ?? []);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, resolution: "applied" } : m)));
  }

  function handleRejectChange(message: DisplayChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, resolution: "dismissed" } : m)));
  }

  function handleAskAiToReplace(item: ItineraryItem, dayNumber: number) {
    setPendingChatMessage(
      `Please replace "${item.title}" on day ${dayNumber} with a good alternative.`
    );
  }

  if (authLoading) return null;
  if (!user) return <LandingPage />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("planner.title")}</h1>
        <p className="text-slate-500 mt-2">{t("planner.subtitle")}</p>
      </div>

      <PlannerForm
        onSubmit={handleGenerate}
        submitting={submitting}
        onDestinationChange={setFormDestination}
        onDaysChange={setFormDays}
      />

      <AiSuggestions destination={formDestination} days={formDays} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {feasibilityNotes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
            <span>⚠️</span> {t("planner.feasibility")}
          </h3>
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
            onAccept={handleAcceptChange}
            onReject={handleRejectChange}
            pendingMessage={pendingChatMessage}
          />
        </div>
      )}
    </div>
  );
}
