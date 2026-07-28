"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api, ApiError } from "@/lib/api";
import { PlannerForm } from "@/components/PlannerForm";
import { AiSuggestions } from "@/components/AiSuggestions";
import { LandingPage } from "@/components/LandingPage";
import { GeneratingOverlay } from "@/components/GeneratingOverlay";
import { GenerateTripInput, Trip } from "@/types";
import { storeFeasibilityNotes } from "@/lib/tripSessionState";

interface GenerateResponse {
  trip: Trip;
  feasibilityNotes: string[];
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formDestination, setFormDestination] = useState("");
  const [formDays, setFormDays] = useState(3);

  async function handleGenerate(input: GenerateTripInput) {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<GenerateResponse>("/ai/generate", input);
      storeFeasibilityNotes(data.trip.id, data.feasibilityNotes ?? []);
      router.push(`/trips/${data.trip.id}?new=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
      setSubmitting(false);
    }
  }

  if (authLoading) return null;
  if (!user) return <LandingPage />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("planner.title")}</h1>
        <p className="text-slate-500 mt-2">{t("planner.subtitle")}</p>
      </div>

      <div className="relative">
        <div
          className={
            submitting
              ? "opacity-40 pointer-events-none select-none transition-opacity"
              : "transition-opacity"
          }
        >
          <PlannerForm
            onSubmit={handleGenerate}
            submitting={submitting}
            onDestinationChange={setFormDestination}
            onDaysChange={setFormDays}
          />
        </div>
        {submitting && <GeneratingOverlay text={t("planner.generatingOverlay")} />}
      </div>

      <AiSuggestions destination={formDestination} days={formDays} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
    </div>
  );
}
