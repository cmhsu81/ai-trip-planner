"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { ApiError } from "@/lib/api";

const inputClass =
  "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-500 transition-shadow";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/trips");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xl shadow-sm mb-3">
            ✈️
          </span>
          <h1 className="text-xl font-semibold text-slate-900">{t("auth.loginTitle")}</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">{t("auth.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">{t("auth.password")}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-600 text-white font-medium rounded-lg py-2.5 hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {t("auth.loginCta")}
          </button>
        </form>
      </div>
      <p className="text-sm text-slate-600 mt-5 text-center">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="text-teal-700 font-medium hover:underline">
          {t("auth.registerCta")}
        </Link>
      </p>
    </div>
  );
}
