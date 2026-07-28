"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { GenerateTripInput } from "@/types";
import { TagInput } from "./TagInput";

interface Props {
  onSubmit: (input: GenerateTripInput) => Promise<void>;
  submitting: boolean;
  onDestinationChange?: (destination: string) => void;
  onDaysChange?: (days: number) => void;
}

function daysBetween(from: string, to: string): number | null {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

const MAX_BUDGET = 5000;

// Internal values stay fixed English tokens (like ItineraryItemType) so the
// prompt sent to Claude is consistent regardless of UI locale; only the
// on-screen label is translated.
const TRAVEL_STYLES = ["relaxed", "moderate", "packed"] as const;
const TRAVEL_STYLE_LABEL_KEYS = [
  "planner.travelStyleRelaxed",
  "planner.travelStyleModerate",
  "planner.travelStylePacked",
] as const;

const inputClass =
  "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-500 transition-shadow";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

export function PlannerForm({ onSubmit, submitting, onDestinationChange, onDaysChange }: Props) {
  const { t, locale } = useLocale();

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);

  useEffect(() => {
    onDestinationChange?.(destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  useEffect(() => {
    onDaysChange?.(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("10:00");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("18:00");
  const [mustSeeAttractions, setMustSeeAttractions] = useState<string[]>([]);
  const [mustEatRestaurants, setMustEatRestaurants] = useState<string[]>([]);
  const [travelStyleIndex, setTravelStyleIndex] = useState(1); // default: moderate
  const [budgetAmount, setBudgetAmount] = useState(500);

  const [suggestedInterests, setSuggestedInterests] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [interestsError, setInterestsError] = useState(false);

  const daysAreDerived = Boolean(arrivalDate && departureDate);
  const sameDayInvalidTime = Boolean(
    arrivalDate && departureDate && arrivalDate === departureDate && departureTime <= arrivalTime
  );

  useEffect(() => {
    // a previously picked departure date can become invalid if the arrival
    // date moves past it — clear it rather than silently keeping a bad range
    if (departureDate && arrivalDate && departureDate < arrivalDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartureDate("");
    }
  }, [arrivalDate, departureDate]);

  useEffect(() => {
    // derive days from the date range whenever it changes
    if (arrivalDate && departureDate) {
      const computed = daysBetween(arrivalDate, departureDate);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (computed) setDays(computed);
    }
  }, [arrivalDate, departureDate]);

  useEffect(() => {
    const trimmed = destination.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestedInterests([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoadingInterests(true);
      setInterestsError(false);
      try {
        const data = await api.post<{ suggestions: string[] }>("/ai/suggest-interests", {
          destination: trimmed,
          locale,
        });
        setSuggestedInterests(data.suggestions);
        setSelectedInterests([]);
      } catch {
        setSuggestedInterests([]);
        setInterestsError(true);
      } finally {
        setLoadingInterests(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [destination, locale]);

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sameDayInvalidTime) return;
    await onSubmit({
      destination,
      days,
      arrivalDate: arrivalDate || undefined,
      arrivalTime: arrivalTime || "10:00",
      departureDate: departureDate || undefined,
      departureTime: departureTime || "18:00",
      interests: selectedInterests.length > 0 ? selectedInterests : undefined,
      mustSeeAttractions: mustSeeAttractions.length > 0 ? mustSeeAttractions : undefined,
      mustEatRestaurants: mustEatRestaurants.length > 0 ? mustEatRestaurants : undefined,
      travelStyle: TRAVEL_STYLES[travelStyleIndex],
      budget: `$${budgetAmount} USD per person`,
      locale,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 sm:grid-cols-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8"
    >
      <div className="sm:col-span-2">
        <label className={labelClass}>{t("planner.destination")}</label>
        <input
          required
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className={inputClass}
          placeholder="Tokyo, Japan"
        />
      </div>

      <div>
        <label className={labelClass}>🛬 {t("planner.arrival")}</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
            className={`flex-1 ${inputClass}`}
          />
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className={`w-28 ${inputClass}`}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>🛫 {t("planner.departure")}</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={departureDate}
            min={arrivalDate || undefined}
            onChange={(e) => setDepartureDate(e.target.value)}
            className={`flex-1 ${inputClass} ${sameDayInvalidTime ? "border-red-400 focus:ring-red-400/60 focus:border-red-400" : ""}`}
          />
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className={`w-28 ${inputClass} ${sameDayInvalidTime ? "border-red-400 focus:ring-red-400/60 focus:border-red-400" : ""}`}
          />
        </div>
        {sameDayInvalidTime && (
          <p className="text-xs text-red-600 mt-1.5">{t("planner.dateTimeError")}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>
          {t("planner.days")}{" "}
          {daysAreDerived && (
            <span className="text-xs font-normal text-teal-600">({t("planner.daysAuto")})</span>
          )}
        </label>
        <input
          type="number"
          min={1}
          max={30}
          required
          disabled={daysAreDerived}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
        />
      </div>
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <label className={labelClass}>
          {t("planner.travelStyle")}:{" "}
          <span className="font-semibold text-teal-700">{t(TRAVEL_STYLE_LABEL_KEYS[travelStyleIndex])}</span>
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={travelStyleIndex}
          onChange={(e) => setTravelStyleIndex(Number(e.target.value))}
          className="w-full accent-teal-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          {TRAVEL_STYLE_LABEL_KEYS.map((key) => (
            <span key={key}>{t(key)}</span>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
        <label className={labelClass}>
          {t("planner.budget")}:{" "}
          <span className="font-semibold text-teal-700">
            ${budgetAmount} USD / {t("planner.perPerson")}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={MAX_BUDGET}
          step={50}
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(Number(e.target.value))}
          className="w-full accent-teal-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>$0</span>
          <span>${MAX_BUDGET}+</span>
        </div>
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass}>{t("planner.interests")}</label>
        {loadingInterests && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            {t("planner.interestsLoading")}
          </p>
        )}
        {!loadingInterests && interestsError && (
          <p className="text-xs text-red-500">{t("planner.interestsError")}</p>
        )}
        {!loadingInterests && !interestsError && suggestedInterests.length === 0 && (
          <p className="text-xs text-slate-400">{t("planner.interestsHint")}</p>
        )}
        {suggestedInterests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {suggestedInterests.map((interest) => {
              const selected = selectedInterests.includes(interest);
              return (
                <button
                  type="button"
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`text-sm rounded-full px-3.5 py-1.5 border transition-colors ${
                    selected
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>{t("planner.mustSee")}</label>
        <TagInput
          values={mustSeeAttractions}
          onChange={setMustSeeAttractions}
          placeholder={t("planner.tagInputPlaceholder")}
        />
      </div>
      <div>
        <label className={labelClass}>{t("planner.mustEat")}</label>
        <TagInput
          values={mustEatRestaurants}
          onChange={setMustEatRestaurants}
          placeholder={t("planner.tagInputPlaceholder")}
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || sameDayInvalidTime}
          className="w-full bg-teal-600 text-white font-medium rounded-lg py-3 hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {submitting ? t("planner.generating") : t("planner.generate")}
        </button>
      </div>
    </form>
  );
}
