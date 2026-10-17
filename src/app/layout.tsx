import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/sonner";
import { listClinics, listEscalations } from "@/lib/api";
import { signOut } from "@/lib/auth-actions";
import { intlLocale, translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";
import { currentTheme } from "@/lib/theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Clinic Scheduler",
  // Static, so it stays Spanish: metadata is generated once, and this is the
  // product language. Nothing a user reads on screen depends on it.
  description: "Agendamiento de citas para clínicas en Colombia",
};

/**
 * The clinic name and the queue count, for the sidebar.
 *
 * Both are decoration on every page but the one they belong to, so neither may
 * break a render: an unreachable API leaves the name blank and the badge at
 * zero rather than failing the whole layout. The pages themselves report a
 * failure properly, which is where a receptionist should hear about it.
 */
async function shellData(): Promise<{ clinicName: string | null; pending: number }> {
  try {
    const clinics = await listClinics();
    const clinic = clinics[0];
    if (!clinic) return { clinicName: null, pending: 0 };
    try {
      const queue = await listEscalations(clinic.id, { status: "open", limit: 1 });
      return { clinicName: clinic.name, pending: queue.total };
    } catch {
      return { clinicName: clinic.name, pending: 0 };
    }
  } catch {
    return { clinicName: null, pending: 0 };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme, role, data] = await Promise.all([
    currentLocale(),
    currentTheme(),
    currentRole(),
    shellData(),
  ]);
  const t = translator(locale);

  return (
    <html
      // Follows the chosen language so a screen reader pronounces it correctly
      // and the browser does not offer to translate a page already in English.
      lang={intlLocale(locale)}
      // The theme class is set on the server from a cookie, so the first paint
      // is already right rather than flashing light and correcting itself.
      className={`${geistSans.variable} ${geistMono.variable} ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <body>
        <Shell
          locale={locale}
          theme={theme}
          role={role}
          clinicName={data.clinicName}
          pendingCount={data.pending}
          // Labels resolved here, because a function cannot cross into a
          // client component -- React serialises data, not closures.
          nav={[
            { href: "/", label: t("nav.overview"), icon: "overview" as const },
            {
              href: "/appointments",
              label: t("nav.appointments"),
              icon: "appointments" as const,
            },
            { href: "/patients", label: t("nav.patients"), icon: "patients" as const },
            { href: "/doctors", label: t("nav.doctors"), icon: "doctors" as const },
            { href: "/escalations", label: t("nav.pending"), icon: "pending" as const },
            { href: "/import", label: t("nav.import"), icon: "import" as const },
            // The audit log names patients, so it is offered only to a role
            // that can read it. The page refuses on its own account too: a
            // hidden link is not a permission check.
            // Both name several patients at once, so both are offered only
            // to a role that may read them. Each page refuses on its own
            // account too: a hidden link is not a permission check.
            {
              href: "/conversation",
              label: t("nav.conversation"),
              icon: "conversation" as const,
            },
            ...(role === "admin"
              ? [
                  {
                    href: "/handsets",
                    label: t("nav.handsets"),
                    icon: "handsets" as const,
                  },
                  { href: "/audit", label: t("nav.audit"), icon: "audit" as const },
                ]
              : []),
          ]}
          labels={{
            clinic: t("shell.clinic"),
            signIn: t("auth.signIn"),
            signOut: t("auth.signOut"),
            admin: t("auth.admin"),
          }}
          signOut={signOut}
        >
          {children}
        </Shell>
        {/* Mounted once. Every action's outcome arrives here rather than in a
            browser dialog: `alert` and `confirm` block the page, cannot be
            styled, and on a reception desk they stack up behind each other. */}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
