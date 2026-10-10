import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Inbox,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

import { ApiFailure, PageHeading, Stat, StatusBadge } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSummary, listEscalations } from "@/lib/api";
import { intlLocale, translator, type CopyKey } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens the
 * page the counts that existed when it was built.
 */
export const dynamic = "force-dynamic";

/** The counts worth showing, in the order they make sense to read. */
const COUNTS: ReadonlyArray<{ key: string; label: CopyKey; icon: React.ReactNode }> = [
  { key: "patients", label: "count.patients", icon: <Users className="size-4" /> },
  {
    key: "appointments",
    label: "count.appointments",
    icon: <CalendarDays className="size-4" />,
  },
  { key: "doctors", label: "count.doctors", icon: <Stethoscope className="size-4" /> },
  {
    key: "availability_rules",
    label: "count.availability_rules",
    icon: <ClipboardList className="size-4" />,
  },
  { key: "consents", label: "count.consents", icon: <ShieldCheck className="size-4" /> },
  { key: "locations", label: "count.locations", icon: <MapPin className="size-4" /> },
];

export default async function OverviewPage() {
  const locale = await currentLocale();
  const t = translator(locale);

  const result = await load("overview", async (clinic) => {
    const [summary, queue] = await Promise.all([
      getSummary(clinic.id),
      // The open-queue count leads the page, because it is the only figure here
      // that means somebody has to do something.
      listEscalations(clinic.id, { status: "open", limit: 1 }),
    ]);
    return { clinic, summary, queue };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { clinic, summary, queue } = result.data;
  const statuses = Object.entries(summary.appointments_by_status);
  const nf = new Intl.NumberFormat(intlLocale(locale));

  return (
    <>
      <PageHeading
        title={clinic.name}
        subtitle={t("overview.subtitle")}
        action={
          <Button asChild>
            <Link href="/appointments/new">
              <CalendarPlus className="size-4" />
              {t("appointments.new")}
            </Link>
          </Button>
        }
      />

      {/* Stated plainly rather than hidden in a footer: while this is on, the
          API refuses real patient data outright and everything here is
          invented. A reviewer should not have to learn that from a document. */}
      {!summary.real_patient_data_allowed ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25">
          <CardContent className="flex items-start gap-3 py-1 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p>
              <span className="font-medium">{t("overview.syntheticTitle")}</span>{" "}
              <span className="text-muted-foreground">{t("overview.syntheticBody")}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* The queue first, when there is one: the only thing on this page that
          is a task rather than a number. */}
      {queue.total > 0 ? (
        <Link href="/escalations" className="group mb-6 block">
          <Card className="border-amber-200 transition-colors group-hover:border-amber-300 dark:border-amber-900/60 dark:group-hover:border-amber-800">
            <CardContent className="flex items-center gap-4">
              <span className="status-held grid size-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset">
                <Inbox className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {nf.format(queue.total)}{" "}
                  {queue.total === 1 ? t("pending.countOne") : t("pending.countMany")}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {t("pending.explainerShort")}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COUNTS.map(({ key, label, icon }) => (
          <Stat
            key={key}
            label={t(label)}
            value={nf.format(summary.row_counts[key] ?? 0)}
            icon={icon}
          />
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("overview.byStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("overview.noAppointments")}</p>
          ) : (
            <ul className="flex flex-wrap gap-x-8 gap-y-4">
              {statuses.map(([status, count]) => (
                <li key={status} className="flex items-center gap-2.5">
                  <StatusBadge status={status} locale={locale} />
                  <span className="text-sm font-medium tabular-nums">{nf.format(count)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
