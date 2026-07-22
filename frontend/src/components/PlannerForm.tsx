"use client";

import { FormEvent, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { GenerateTripInput } from "@/types";

interface Props {
  onSubmit: (input: GenerateTripInput) => Promise<void>;
  submitting: boolean;
}

function splitList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function PlannerForm({ onSubmit, submitting }: Props) {
  const { t } = useLocale();
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState("");
  const [interests, setInterests] = useState("");
  const [mustSee, setMustSee] = useState("");
  const [mustEat, setMustEat] = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [budget, setBudget] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({
      destination,
      days,
      startDate: startDate || undefined,
      interests: splitList(interests),
      mustSeeAttractions: splitList(mustSee),
      mustEatRestaurants: splitList(mustEat),
      travelStyle: travelStyle || undefined,
      budget: budget || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-sm text-slate-600 mb-1">{t("planner.destination")}</label>
        <input
          required
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
          placeholder="Tokyo, Japan"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.days")}</label>
        <input
          type="number"
          min={1}
          max={30}
          required
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.startDate")}</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm text-slate-600 mb-1">{t("planner.interests")}</label>
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
          placeholder="food, hiking, museums"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.mustSee")}</label>
        <input
          value={mustSee}
          onChange={(e) => setMustSee(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.mustEat")}</label>
        <input
          value={mustEat}
          onChange={(e) => setMustEat(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.travelStyle")}</label>
        <input
          value={travelStyle}
          onChange={(e) => setTravelStyle(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
          placeholder="relaxed / packed / family-friendly"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">{t("planner.budget")}</label>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
          placeholder="budget / mid-range / luxury"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-50"
        >
          {submitting ? t("planner.generating") : t("planner.generate")}
        </button>
      </div>
    </form>
  );
}
