"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import en from "@/lib/i18n/en.json";
import zh from "@/lib/i18n/zh.json";

type Dictionary = typeof en;
type Locale = "en" | "zh";

const dictionaries: Record<Locale, Dictionary> = { en, zh };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Dictionary) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    // hydrate locale from localStorage once after mount (avoids SSR/hydration mismatch)
    const stored = localStorage.getItem("locale") as Locale | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "en" || stored === "zh") setLocaleState(stored);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("locale", next);
  };

  const t = useMemo(() => {
    const dict = dictionaries[locale];
    return (key: keyof Dictionary) => dict[key] ?? key;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
