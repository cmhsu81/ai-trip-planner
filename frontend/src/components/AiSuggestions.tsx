"use client";

import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { QuickSuggestion } from "@/types";
import { Modal } from "./Modal";

interface Props {
  destination: string;
  days: number;
}

export function AiSuggestions({ destination, days }: Props) {
  const { t, locale } = useLocale();
  const [suggestions, setSuggestions] = useState<QuickSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState(false);
  // Remembers answers for this destination's session so reopening a
  // previously-clicked suggestion doesn't re-trigger a paid quick-answer call.
  const [answerCache, setAnswerCache] = useState<Record<string, string>>({});

  async function loadSuggestions(exclude: string[] = []) {
    if (!destination.trim()) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.post<{ suggestions: QuickSuggestion[] }>("/ai/quick-suggestions", {
        destination,
        days,
        locale,
        exclude,
      });
      setSuggestions(data.suggestions);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function askSuggestion(s: QuickSuggestion) {
    setActiveLabel(s.label);
    setAnswerError(false);

    const cached = answerCache[s.question];
    if (cached !== undefined) {
      setAnswer(cached);
      return;
    }

    setAnswer(null);
    setAnswerLoading(true);
    try {
      const data = await api.post<{ answer: string }>("/ai/quick-answer", {
        destination,
        days,
        question: s.question,
        locale,
      });
      setAnswer(data.answer);
      setAnswerCache((prev) => ({ ...prev, [s.question]: data.answer }));
    } catch {
      setAnswerError(true);
    } finally {
      setAnswerLoading(false);
    }
  }

  if (!destination.trim()) return null;

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-800 flex items-center gap-2">
          <span className="text-lg">💡</span> {t("aiSuggestions.title")}
        </h3>
        {suggestions.length > 0 && (
          <button
            onClick={() => loadSuggestions(suggestions.map((s) => s.label))}
            disabled={loading}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium disabled:opacity-50"
          >
            {t("aiSuggestions.regenerate")}
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <button
          onClick={() => loadSuggestions()}
          disabled={loading}
          className="text-sm border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
        >
          {loading ? t("common.loading") : t("aiSuggestions.cta")}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => askSuggestion(s)}
              className="text-sm rounded-full px-3.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loadError && <p className="text-xs text-red-500 mt-2">{t("aiSuggestions.error")}</p>}

      {activeLabel && (
        <Modal title={activeLabel} onClose={() => setActiveLabel(null)}>
          {answerLoading
            ? t("common.loading")
            : answerError
              ? t("aiSuggestions.error")
              : answer}
        </Modal>
      )}
    </div>
  );
}
