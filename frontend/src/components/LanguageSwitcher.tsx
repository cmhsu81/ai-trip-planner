"use client";

import { useLocale } from "@/contexts/LocaleContext";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 text-sm bg-slate-100 rounded-full p-0.5">
      <button
        onClick={() => setLocale("zh")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "zh" ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          locale === "en" ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        EN
      </button>
    </div>
  );
}
