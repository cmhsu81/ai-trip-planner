"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/LocaleContext";

export function LandingPage() {
  const { t } = useLocale();

  const features: {
    icon: string;
    titleKey: "landing.feature1Title" | "landing.feature2Title" | "landing.feature3Title";
    descKey: "landing.feature1Desc" | "landing.feature2Desc" | "landing.feature3Desc";
    accent: string;
  }[] = [
    { icon: "🔎", titleKey: "landing.feature1Title", descKey: "landing.feature1Desc", accent: "from-teal-400 to-emerald-500" },
    { icon: "✅", titleKey: "landing.feature2Title", descKey: "landing.feature2Desc", accent: "from-amber-400 to-orange-500" },
    { icon: "💬", titleKey: "landing.feature3Title", descKey: "landing.feature3Desc", accent: "from-sky-400 to-indigo-500" },
  ];

  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden text-center py-20 px-6 rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 text-white shadow-xl">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-teal-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute top-10 right-1/4 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-teal-300 bg-teal-400/10 border border-teal-400/30 rounded-full px-4 py-1.5 mb-6">
            ✨ {t("landing.kicker")}
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold max-w-3xl mx-auto leading-[1.1] tracking-tight">
            {t("landing.title")}
          </h1>
          <p className="text-slate-300 max-w-xl mx-auto mt-5 text-lg">{t("landing.subtitle")}</p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link
              href="/register"
              className="bg-teal-400 text-slate-950 font-semibold rounded-full px-7 py-3.5 hover:bg-teal-300 transition-colors shadow-lg shadow-teal-500/20"
            >
              {t("landing.ctaRegister")}
            </Link>
            <Link
              href="/login"
              className="border border-white/25 text-white font-medium rounded-full px-7 py-3.5 hover:bg-white/10 transition-colors"
            >
              {t("landing.ctaLogin")}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.titleKey}
            className="group border border-slate-200 rounded-2xl p-7 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.accent} text-2xl mb-4 shadow-sm`}
            >
              {f.icon}
            </div>
            <h3 className="font-semibold text-slate-900 mb-2 text-lg">{t(f.titleKey)}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{t(f.descKey)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
