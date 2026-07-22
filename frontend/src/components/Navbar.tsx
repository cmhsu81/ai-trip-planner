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
    <header className="border-b border-slate-200">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-slate-900">
          {t("nav.brand")}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            {t("nav.plan")}
          </Link>
          {user && (
            <Link href="/trips" className="text-slate-600 hover:text-slate-900">
              {t("nav.trips")}
            </Link>
          )}
          {user ? (
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="text-slate-600 hover:text-slate-900"
            >
              {t("nav.logout")}
            </button>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                {t("nav.login")}
              </Link>
              <Link href="/register" className="text-slate-600 hover:text-slate-900">
                {t("nav.register")}
              </Link>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}
