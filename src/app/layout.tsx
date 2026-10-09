import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  description: "Agendamiento de citas para clínicas en Colombia",
};

/**
 * Where the shell links. Kept here rather than inside the header so adding a
 * section is one line, and so the order is visible in one place.
 *
 * Spanish labels: the people who will use this work in Spanish, and the
 * product language rule applies to anything they read.
 */
const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/patients", label: "Pacientes" },
  { href: "/doctors", label: "Médicos" },
  { href: "/appointments", label: "Citas" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
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
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
