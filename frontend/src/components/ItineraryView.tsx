"use client";

import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { ItineraryDay, ItineraryItem } from "@/types";

const TYPE_LABEL: Record<ItineraryItem["type"], string> = {
  attraction: "🏛️",
  restaurant: "🍽️",
  activity: "🎟️",
  transport: "🚗",
  lodging: "🏨",
};

interface Props {
  tripId: string;
  itineraryDays: ItineraryDay[];
  onChange: (days: ItineraryDay[]) => void;
  onAskAiToReplace: (item: ItineraryItem, dayNumber: number) => void;
}

export function ItineraryView({ tripId, itineraryDays, onChange, onAskAiToReplace }: Props) {
  const { t } = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ItineraryItem>>({});

  if (itineraryDays.length === 0) {
    return <p className="text-slate-500 text-sm">{t("itinerary.empty")}</p>;
  }

  function updateItemLocal(dayId: string, itemId: string, patch: Partial<ItineraryItem>) {
    onChange(
      itineraryDays.map((day) =>
        day.id !== dayId
          ? day
          : {
              ...day,
              items: day.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
      )
    );
  }

  function removeItemLocal(dayId: string, itemId: string) {
    onChange(
      itineraryDays.map((day) =>
        day.id !== dayId ? day : { ...day, items: day.items.filter((item) => item.id !== itemId) }
      )
    );
  }

  async function toggleConfirmed(dayId: string, item: ItineraryItem) {
    updateItemLocal(dayId, item.id, { confirmed: !item.confirmed });
    await api.patch(`/trips/${tripId}/items/${item.id}`, { confirmed: !item.confirmed });
  }

  async function deleteItem(dayId: string, item: ItineraryItem) {
    removeItemLocal(dayId, item.id);
    await api.delete(`/trips/${tripId}/items/${item.id}`);
  }

  function startEdit(item: ItineraryItem) {
    setEditingId(item.id);
    setDraft(item);
  }

  async function saveEdit(dayId: string, itemId: string) {
    const patch = {
      title: draft.title,
      time: draft.time ?? undefined,
      estimatedDuration: draft.estimatedDuration ?? undefined,
      description: draft.description ?? undefined,
      location: draft.location ?? undefined,
    };
    updateItemLocal(dayId, itemId, patch);
    setEditingId(null);
    await api.patch(`/trips/${tripId}/items/${itemId}`, patch);
  }

  return (
    <div className="space-y-6">
      {itineraryDays.map((day) => (
        <div key={day.id}>
          <h3 className="font-semibold text-slate-800 mb-2">
            {t("itinerary.day")} {day.dayNumber} {day.date ? `· ${day.date}` : ""}
          </h3>
          <ul className="space-y-2">
            {day.items.map((item) => (
              <li
                key={item.id}
                className={`border rounded-lg p-3 ${item.confirmed ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                      value={draft.title ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="time"
                        className="w-24 border border-slate-300 rounded px-2 py-1 text-sm"
                        value={draft.time ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                      />
                      <input
                        placeholder="duration"
                        className="w-32 border border-slate-300 rounded px-2 py-1 text-sm"
                        value={draft.estimatedDuration ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, estimatedDuration: e.target.value }))
                        }
                      />
                    </div>
                    <textarea
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(day.id, item.id)}
                        className="text-xs bg-slate-900 text-white rounded px-3 py-1"
                      >
                        {t("itinerary.save")}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs border border-slate-300 rounded px-3 py-1"
                      >
                        {t("itinerary.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.confirmed}
                      onChange={() => toggleConfirmed(day.id, item)}
                      className="mt-1"
                      title={t("itinerary.confirmed")}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{TYPE_LABEL[item.type]}</span>
                        {item.time && <span className="text-slate-400">{item.time}</span>}
                        <span className="font-medium text-slate-900">{item.title}</span>
                        {item.estimatedDuration && (
                          <span className="text-slate-400 text-xs">({item.estimatedDuration})</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      )}
                      {item.location && (
                        <p className="text-xs text-slate-400 mt-1">📍 {item.location}</p>
                      )}
                      {item.sourceNote && (
                        <p className="text-xs text-slate-400 mt-1 italic">{item.sourceNote}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-xs">
                        <button onClick={() => startEdit(item)} className="text-slate-500 underline">
                          {t("itinerary.edit")}
                        </button>
                        <button
                          onClick={() => onAskAiToReplace(item, day.dayNumber)}
                          className="text-slate-500 underline"
                        >
                          🔁 AI
                        </button>
                        <button
                          onClick={() => deleteItem(day.id, item)}
                          className="text-red-500 underline"
                        >
                          {t("itinerary.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
