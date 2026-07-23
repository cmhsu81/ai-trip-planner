"use client";

import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { ItineraryDay, ItineraryItem } from "@/types";

const TYPE_STYLE: Record<ItineraryItem["type"], { icon: string; badge: string }> = {
  attraction: { icon: "🏛️", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  restaurant: { icon: "🍽️", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  activity: { icon: "🎟️", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  transport: { icon: "🚗", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  lodging: { icon: "🏨", badge: "bg-pink-50 text-pink-700 border-pink-200" },
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
    return (
      <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center">
        <p className="text-slate-400 text-sm">{t("itinerary.empty")}</p>
      </div>
    );
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
    <div className="space-y-8">
      {itineraryDays.map((day) => (
        <div key={day.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium rounded-full px-3.5 py-1">
              {t("itinerary.day")} {day.dayNumber}
            </span>
            {day.date && <span className="text-sm text-slate-400">{day.date}</span>}
          </div>
          <ul className="space-y-3">
            {day.items.map((item) => {
              const style = TYPE_STYLE[item.type];
              return (
                <li
                  key={item.id}
                  className={`border rounded-2xl p-4 transition-shadow ${
                    item.confirmed
                      ? "border-slate-200 bg-white shadow-sm hover:shadow-md"
                      : "border-slate-100 bg-slate-50/60 opacity-60"
                  }`}
                >
                  {editingId === item.id ? (
                    <div className="space-y-2.5">
                      <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/60"
                        value={draft.title ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <input
                          placeholder="time"
                          className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/60"
                          value={draft.time ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                        />
                        <input
                          placeholder="duration"
                          className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/60"
                          value={draft.estimatedDuration ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, estimatedDuration: e.target.value }))
                          }
                        />
                      </div>
                      <textarea
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/60"
                        value={draft.description ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(day.id, item.id)}
                          className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-full px-3.5 py-1.5 transition-colors"
                        >
                          {t("itinerary.save")}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs border border-slate-300 rounded-full px-3.5 py-1.5 hover:bg-slate-50"
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
                        className="mt-1.5 h-4 w-4 accent-teal-600 cursor-pointer"
                        title={t("itinerary.confirmed")}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${style.badge}`}>
                            {style.icon} {item.type}
                          </span>
                          {item.time && (
                            <span className="text-xs font-medium text-slate-500">{item.time}</span>
                          )}
                          {item.estimatedDuration && (
                            <span className="text-xs text-slate-400">· {item.estimatedDuration}</span>
                          )}
                        </div>
                        <p className="font-medium text-slate-900 mt-1.5">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                        )}
                        {item.location && (
                          <p className="text-xs text-slate-400 mt-1.5">📍 {item.location}</p>
                        )}
                        {item.sourceNote && (
                          <p className="text-xs text-teal-700/70 mt-1 italic">✦ {item.sourceNote}</p>
                        )}
                        <div className="flex gap-4 mt-2.5 text-xs font-medium">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-slate-500 hover:text-teal-700 transition-colors"
                          >
                            {t("itinerary.edit")}
                          </button>
                          <button
                            onClick={() => onAskAiToReplace(item, day.dayNumber)}
                            className="text-slate-500 hover:text-teal-700 transition-colors"
                          >
                            🔁 AI
                          </button>
                          <button
                            onClick={() => deleteItem(day.id, item)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            {t("itinerary.delete")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
