import { Info } from "lucide-react";

import { LiveUpdates } from "@/components/live";
import { ApiFailure, PageHeading } from "@/components/page";
import {
  CancellationTable,
  FunnelGrid,
  PunctualityTable,
  RateCard,
  ZoneTable,
} from "@/components/reports";
import { Card, CardContent } from "@/components/ui/card";
import { getPunctuality, getReportSummary, getZoneReport } from "@/lib/api-import";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the numbers change as staff record appointments. */
export const dynamic = "force-dynamic";

/**
 * M4's management panel (Rev3: "Summary panel for a date range").
 *
 * Three views on one page, because a manager comparing the funnel against the
 * geographic breakdown should not have to navigate between them.
 *
 * Every figure here is computed from `appointment_events` rather than from
 * current status. That is ADR-14, and the consequence is visible: an
 * appointment rescheduled twice and then attended appears in both the
 * rescheduled and completed counts, which a status column could never show.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [locale, query] = await Promise.all([currentLocale(), searchParams]);
  const t = translator(locale);

  const range = { start_date: query.from, end_date: query.to };

  const result = await load("reports", async (clinic) => {
    const [summary, zones, punctuality] = await Promise.all([
      getReportSummary(clinic.id, range),
      getZoneReport(clinic.id, range),
      getPunctuality(clinic.id, range),
    ]);
    return { summary, zones, punctuality };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { summary, zones, punctuality } = result.data;

  const actorNames: Record<string, string> = {
    patient: t("reports.actorPatient"),
    staff: t("reports.actorStaff"),
    system: t("reports.actorSystem"),
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <PageHeading title={t("reports.title")} subtitle={t("reports.subtitle")} />
        <LiveUpdates
          labels={{
            live: t("live.live"),
            polling: t("live.polling"),
            updated: t("live.updated"),
          }}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{t("reports.funnel")}</h2>
        <FunnelGrid
          funnel={summary.funnel}
          labels={{
            offered: t("reports.offered"),
            confirmed: t("reports.confirmed"),
            rescheduled: t("reports.rescheduled"),
            cancelled: t("reports.cancelled"),
            no_show: t("reports.noShow"),
            completed: t("reports.completed"),
            scheduled: t("reports.scheduled"),
          }}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold">{t("reports.rates")}</h2>
        <p className="text-muted-foreground mb-3 flex items-start gap-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t("reports.formulaHint")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary.percentages).map(([name, value]) => (
            <RateCard
              key={name}
              label={name.replace(/_pct$/, "").replace(/_/g, " ")}
              value={value}
              /* The formula comes from the API, not from here: a copy in the
                 frontend is a copy that drifts from the SQL. */
              formula={summary.formulas[name] ?? ""}
              noData={t("reports.noData")}
            />
          ))}
        </div>
      </section>

      {summary.cancellations.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">{t("reports.cancellationsBy")}</h2>
          <Card className="overflow-hidden py-0">
            <CancellationTable
              rows={summary.cancellations}
              labels={{
                reason: t("reports.cancellationsBy"),
                actor: t("reports.actor"),
                count: t("count.appointments"),
                actorNames,
              }}
            />
          </Card>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">{t("reports.zones")}</h2>
        <Card>
          <CardContent>
            <ZoneTable
              report={zones}
              labels={{
                municipality: t("reports.municipality"),
                neighborhood: t("reports.neighborhood"),
                appointments: t("count.appointments"),
                noShow: t("reports.noShow"),
                suppressed: t("reports.suppressed"),
                suppressedCount: t("reports.suppressedCount"),
                noZoneData: t("reports.noZoneData"),
                hint: t("reports.zonesHint").replace(
                  "{n}",
                  String(zones.minimum_group_size),
                ),
              }}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">{t("reports.punctuality")}</h2>
        <Card>
          <CardContent>
            <PunctualityTable
              rows={punctuality}
              labels={{
                doctor: t("nav.doctors"),
                startDelay: t("reports.startDelay"),
                overrun: t("reports.overrun"),
                coverage: t("reports.coverage"),
                minutes: t("reports.minutes"),
                notRecorded: t("reports.notRecorded"),
                hint: t("reports.punctualityHint"),
                noData: t("reports.noData"),
              }}
            />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
