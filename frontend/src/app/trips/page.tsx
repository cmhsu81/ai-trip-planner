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
        <h1 className="text-2xl font-semibold text-slate-900">{t("trips.title")}</h1>
        <Link href="/" className="text-sm bg-slate-900 text-white rounded px-4 py-2">
          {t("trips.newTrip")}
        </Link>
      </div>

      {trips.length === 0 ? (
        <p className="text-slate-500">{t("trips.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{trip.title}</p>
                <p className="text-sm text-slate-500">
                  {trip.destination} · {trip.days} {t("planner.days")}
                  {trip.arrivalDate ? ` · ${trip.arrivalDate.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/trips/${trip.id}`} className="text-slate-900 underline">
                  {t("trips.viewButton")}
                </Link>
                <button onClick={() => handleDelete(trip.id)} className="text-red-500 underline">
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
