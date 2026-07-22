"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { ItineraryView } from "@/components/ItineraryView";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatMessage, ItineraryDay, ItineraryItem, Trip } from "@/types";

interface ChatResponse {
  reply: string;
  trip: Trip;
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<{ trip: Trip }>(`/trips/${params.id}`)
      .then((data) => {
        setTrip(data.trip);
        setItineraryDays(data.trip.itineraryDays ?? []);
        setMessages(data.trip.chatMessages ?? []);
      })
      .finally(() => setLoading(false));
  }, [params.id, user, authLoading, router]);

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

  if (loading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!trip) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{trip.title}</h1>
        <p className="text-slate-500">
          {trip.destination} · {trip.days} {t("planner.days")}
        </p>
      </div>

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
    </div>
  );
}
