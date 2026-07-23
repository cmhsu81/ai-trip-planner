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
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);

  async function loadSuggestions(exclude: string[] = []) {
    if (!destination.trim()) return;
    setLoading(true);
    try {
      const data = await api.post<{ suggestions: QuickSuggestion[] }>("/ai/quick-suggestions", {
        destination,
        days,
        locale,
        exclude,
      });
      setSuggestions(data.suggestions);
    } finally {
      setLoading(false);
    }
  }

  async function askSuggestion(s: QuickSuggestion) {
    setActiveLabel(s.label);
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
    } finally {
      setAnswerLoading(false);
    }
  }

  if (!destination.trim()) return null;

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-800">{t("aiSuggestions.title")}</h3>
        {suggestions.length > 0 && (
          <button
            onClick={() => loadSuggestions(suggestions.map((s) => s.label))}
            disabled={loading}
            className="text-xs text-slate-500 underline disabled:opacity-50"
          >
            {t("aiSuggestions.regenerate")}
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <button
          onClick={() => loadSuggestions()}
          disabled={loading}
          className="text-sm border border-slate-300 rounded-full px-4 py-2 disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("aiSuggestions.cta")}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => askSuggestion(s)}
              className="text-sm rounded-full px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {activeLabel && (
        <Modal title={activeLabel} onClose={() => setActiveLabel(null)}>
          {answerLoading ? t("common.loading") : answer}
        </Modal>
      )}
    </div>
  );
}
