import { getSummary } from "@/lib/api";
import { load } from "@/lib/load";
import { ApiFailure, Card, PageHeading, Stat, StatusBadge } from "@/components/ui";
import { intlLocale, translator, type CopyKey } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens
 * the page the patients that existed when it was built. Marking the route
 * dynamic is the correctness requirement here, not a performance trade.
 */
export const dynamic = "force-dynamic";

/** The row counts worth showing, in the order they make sense to read. */
const COUNTS: ReadonlyArray<readonly [key: string, label: CopyKey]> = [
  ["patients", "count.patients"],
  ["doctors", "count.doctors"],
  ["appointments", "count.appointments"],
  ["availability_rules", "count.availability_rules"],
  ["consents", "count.consents"],
  ["locations", "count.locations"],
];

export default async function OverviewPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const result = await load("overview", (clinic) => getSummary(clinic.id));
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const clinicName = result.clinic.name;
  const summary = result.data;

  const statuses = Object.entries(summary.appointments_by_status);

  return (
    <>
      <PageHeading title={clinicName} subtitle={t("overview.subtitle")} />

      {/* Stated plainly rather than hidden: while this is on, the API refuses
          real patient data outright, and everything on screen is invented. */}
      {!summary.real_patient_data_allowed ? (
        <Card className="mb-6 border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-sm text-amber-900">
            <span className="font-medium">{t("overview.syntheticTitle")}</span>{" "}
            {t("overview.syntheticBody")}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COUNTS.map(([key, label]) => (
          <Stat
            key={key}
            label={t(label)}
            value={(summary.row_counts[key] ?? 0).toLocaleString(intlLocale(locale))}
          />
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t("overview.byStatus")}
      </h2>
      <Card className="px-5 py-4">
        {statuses.length === 0 ? (
          <p className="text-sm text-slate-500">{t("overview.noAppointments")}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {statuses.map(([status, count]) => (
              <li key={status} className="flex items-center gap-2.5">
                <StatusBadge status={status} locale={locale} />
                <span className="text-sm tabular-nums text-slate-700">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
