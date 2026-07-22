"use client";

import { useLocale } from "@/contexts/LocaleContext";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => setLocale("zh")}
        className={`px-2 py-1 rounded ${locale === "zh" ? "bg-slate-900 text-white" : "text-slate-500"}`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`px-2 py-1 rounded ${locale === "en" ? "bg-slate-900 text-white" : "text-slate-500"}`}
      >
        EN
      </button>
    </div>
  );
}
