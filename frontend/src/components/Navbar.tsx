"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-base shadow-sm">
            ✈️
          </span>
          {t("nav.brand")}
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/" className="text-slate-600 hover:text-teal-700 transition-colors">
            {t("nav.plan")}
          </Link>
          {user && (
            <Link href="/trips" className="text-slate-600 hover:text-teal-700 transition-colors">
              {t("nav.trips")}
            </Link>
          )}
          {user ? (
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="text-slate-600 hover:text-teal-700 transition-colors"
            >
              {t("nav.logout")}
            </button>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-teal-700 transition-colors">
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className="bg-slate-900 text-white rounded-full px-4 py-1.5 hover:bg-teal-700 transition-colors"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
          <div className="pl-2 border-l border-slate-200">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>
    </header>
  );
}
