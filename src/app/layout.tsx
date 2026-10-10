import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { LanguageSwitch } from "@/components/language";
import { intlLocale, translator, type CopyKey } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clinic Scheduler",
  // Static, so it stays Spanish: metadata is generated once and this is the
  // product language. Nothing a user reads on screen depends on it.
  description: "Agendamiento de citas para clínicas en Colombia",
};

/**
 * Where the shell links. Kept here rather than inside the header so adding a
 * section is one line, and so the order is visible in one place.
 *
 * Labels come from the copy table: Spanish by default, because the people who
 * will use this work in Spanish, with English available per browser for a
 * developer who does not.
 */
const NAV: readonly { href: string; key: CopyKey }[] = [
  { href: "/", key: "nav.overview" },
  { href: "/patients", key: "nav.patients" },
  { href: "/doctors", key: "nav.doctors" },
  { href: "/appointments", key: "nav.appointments" },
  { href: "/escalations", key: "nav.pending" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const t = translator(locale);

  return (
    <html
      // Follows the chosen language so a screen reader pronounces it correctly
      // and the browser does not offer to translate a page already in English.
      lang={intlLocale(locale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm font-semibold text-white">
                C
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Clinic Scheduler
              </span>
            </Link>
            <nav className="flex flex-1 gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            <LanguageSwitch locale={locale} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
