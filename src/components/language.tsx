"use client";

/**
 * The language switch.
 *
 * Spanish is the product language and the default; English is here so a
 * developer who does not read Spanish can work on the dashboard. The choice is
 * a cookie on this browser, so switching never changes what a clinic sees on
 * theirs.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "es" ? "en" : "es";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={next === "en" ? "Switch to English" : "Cambiar a español"}
      onClick={() => {
        // A year, and same-site: this is a display preference, not a session.
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        // The server renders the language, so the page has to be re-fetched
        // rather than re-rendered from what the browser already holds.
        start(() => router.refresh());
      }}
      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
    >
      {pending ? "…" : next === "en" ? "EN" : "ES"}
    </button>
  );
}
