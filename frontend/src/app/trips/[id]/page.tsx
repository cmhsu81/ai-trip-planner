"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { ItineraryView } from "@/components/ItineraryView";
import { ChatPanel } from "@/components/ChatPanel";
import { Modal } from "@/components/Modal";
import { consumeFeasibilityNotes } from "@/lib/tripSessionState";
import { DisplayChatMessage, ItineraryDay, ItineraryDraft, ItineraryItem, Trip } from "@/types";

interface ChatResponse {
  messageId: string;
  reply: string;
  isChangeRequest: boolean;
  proposedItinerary: ItineraryDraft | null;
}

interface ChatApplyResponse {
  trip: Trip;
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLocale();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [messages, setMessages] = useState<DisplayChatMessage[]>([]);
  const [feasibilityNotes, setFeasibilityNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | undefined>(undefined);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isNew) setFeasibilityNotes(consumeFeasibilityNotes(params.id));
    api
      .get<{ trip: Trip }>(`/trips/${params.id}`)
      .then((data) => {
        setTrip(data.trip);
        setItineraryDays(data.trip.itineraryDays ?? []);
        setMessages(data.trip.chatMessages ?? []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, user, authLoading, router]);

  function handleBack() {
    if (isNew) {
      setShowSaveConfirm(true);
    } else {
      router.push("/trips");
    }
  }

  function handleConfirmSave() {
    router.push("/");
  }

  async function handleDiscard() {
    if (!trip) return;
    setDiscarding(true);
    try {
      await api.delete(`/trips/${trip.id}`);
      router.push("/");
    } finally {
      setDiscarding(false);
    }
  }

  async function handleSendChat(message: string) {
    if (!trip) return;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    const data = await api.post<ChatResponse>("/ai/chat", { tripId: trip.id, message, locale });
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

  if (loading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!trip) return null;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={handleBack}
          className="text-sm text-slate-500 hover:text-teal-700 transition-colors mb-2 inline-flex items-center gap-1"
        >
          ← {t("common.back")}
        </button>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{trip.title}</h1>
        <p className="text-slate-500 mt-1">
          {trip.destination} · {trip.days} {t("planner.days")}
        </p>
      </div>

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

      {showSaveConfirm && (
        <Modal
          title={t("trips.saveConfirmTitle")}
          icon="💾"
          onClose={() => setShowSaveConfirm(false)}
        >
          <p className="mb-4">{t("trips.saveConfirmBody")}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleDiscard}
              disabled={discarding}
              className="text-sm border border-slate-300 text-slate-600 rounded-full px-4 py-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {t("trips.saveConfirmNo")}
            </button>
            <button
              onClick={handleConfirmSave}
              className="text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 transition-colors"
            >
              {t("trips.saveConfirmYes")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
