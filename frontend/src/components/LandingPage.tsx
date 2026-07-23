"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/LocaleContext";

export function LandingPage() {
  const { t } = useLocale();

  const features: { icon: string; titleKey: "landing.feature1Title" | "landing.feature2Title" | "landing.feature3Title"; descKey: "landing.feature1Desc" | "landing.feature2Desc" | "landing.feature3Desc" }[] = [
    { icon: "🔎", titleKey: "landing.feature1Title", descKey: "landing.feature1Desc" },
    { icon: "✅", titleKey: "landing.feature2Title", descKey: "landing.feature2Desc" },
    { icon: "💬", titleKey: "landing.feature3Title", descKey: "landing.feature3Desc" },
  ];

  return (
    <div className="space-y-16">
      <section className="text-center py-16 px-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
        <p className="text-sm uppercase tracking-widest text-slate-300 mb-3">
          {t("landing.kicker")}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl mx-auto leading-tight">
          {t("landing.title")}
        </h1>
        <p className="text-slate-300 max-w-xl mx-auto mt-4 text-lg">{t("landing.subtitle")}</p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            href="/register"
            className="bg-white text-slate-900 font-medium rounded-full px-6 py-3 hover:bg-slate-100"
          >
            {t("landing.ctaRegister")}
          </Link>
          <Link
            href="/login"
            className="border border-white/40 text-white font-medium rounded-full px-6 py-3 hover:bg-white/10"
          >
            {t("landing.ctaLogin")}
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.titleKey} className="border border-slate-200 rounded-2xl p-6 bg-white">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-slate-900 mb-2">{t(f.titleKey)}</h3>
            <p className="text-sm text-slate-500">{t(f.descKey)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
