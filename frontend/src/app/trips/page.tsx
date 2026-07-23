"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { api } from "@/lib/api";
import { TripSummary } from "@/types";

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<{ trips: TripSummary[] }>("/trips")
      .then((data) => setTrips(data.trips))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleDelete(id: string) {
    await api.delete(`/trips/${id}`);
    setTrips((prev) => prev.filter((trip) => trip.id !== id));
  }

  if (loading) return <p className="text-slate-500">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("trips.title")}</h1>
        <Link
          href="/"
          className="text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 transition-colors shadow-sm"
        >
          + {t("trips.newTrip")}
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="text-slate-400 text-sm">{t("trips.empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{trip.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {trip.destination} · {trip.days} {t("planner.days")}
                  {trip.arrivalDate ? ` · ${trip.arrivalDate.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <Link href={`/trips/${trip.id}`} className="text-teal-700 font-medium hover:underline">
                  {t("trips.viewButton")}
                </Link>
                <button
                  onClick={() => handleDelete(trip.id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  {t("trips.deleteButton")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
