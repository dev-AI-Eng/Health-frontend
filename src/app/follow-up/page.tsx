import Link from "next/link";
import { Info, PhoneCall } from "lucide-react";
import { cn } from "cn";

import { LiveUpdates } from "@/components/live";
import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFollowUp } from "@/lib/api-import";
import { translator, intlLocale } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: who has answered changes through the day. */
export const dynamic = "force-dynamic";

/**
 * The follow-up list, as the client asked for it.
 *
 * Four states, and the third is the whole point. A `scheduled` appointment
 * means one of two different things — "we reminded them and they went quiet"
 * or "we have not reminded them yet" — and only the first is a phone call.
 * The reminder flags on the appointment are what separate them, which is why
 * this screen works before M4's channels exist at all.
 *
 * Names are shown and identifiers are not. Staff ringing a patient need the
 * name to know who they are calling; the number comes from the patient's own
 * record, where unmasking is audited as a disclosure (ADR-13).
 */
export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{ response?: string; from?: string; to?: string }>;
}) {
  const [locale, query] = await Promise.all([currentLocale(), searchParams]);
  const t = translator(locale);
  const selected = query.response ?? "no_response";

  const result = await load("follow-up", (clinic) =>
    getFollowUp(clinic.id, {
      start_date: query.from,
      end_date: query.to,
      // Defaults to the call list rather than to everything: that is the
      // reason a receptionist opens this screen.
      response: selected === "all" ? undefined : selected,
      limit: 200,
    }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const rows = result.data;

  const FILTERS = [
    { value: "no_response", label: t("followUp.noResponse") },
    { value: "not_yet_reminded", label: t("followUp.notYetReminded") },
    { value: "confirmed", label: t("followUp.confirmed") },
    { value: "cancelled", label: t("followUp.cancelled") },
    { value: "all", label: t("followUp.all") },
  ];

  const RESPONSE_LABEL: Record<string, string> = {
    confirmed: t("followUp.confirmed"),
    cancelled: t("followUp.cancelled"),
    no_response: t("followUp.noResponse"),
    not_yet_reminded: t("followUp.notYetReminded"),
  };

  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <PageHeading title={t("followUp.title")} subtitle={t("followUp.subtitle")} />
        <LiveUpdates
          labels={{
            live: t("live.live"),
            polling: t("live.polling"),
            updated: t("live.updated"),
          }}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/follow-up?response=${filter.value}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              selected === filter.value
                ? "border-primary bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {/* Why this filter means what it means. Without it, "no response" reads
          as a count rather than as an action. */}
      <p className="text-muted-foreground mb-4 flex items-start gap-2 text-sm">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {selected === "no_response"
          ? t("followUp.noResponseHint")
          : selected === "not_yet_reminded"
            ? t("followUp.notYetHint")
            : t("followUp.subtitle")}
      </p>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty icon={<PhoneCall className="size-5" />}>{t("followUp.none")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("appointments.col.patient")}</TableHead>
                  <TableHead>{t("appointments.col.when")}</TableHead>
                  <TableHead>{t("appointments.col.doctor")}</TableHead>
                  <TableHead>{t("followUp.response")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.appointment_id}>
                    <TableCell className="font-medium">
                      {/* Links to the patient, where an administrator can
                          unmask the number to call them -- and that unmasking
                          is recorded as a disclosure. */}
                      <Link
                        href={`/patients/${row.patient_id}`}
                        className="hover:text-primary underline-offset-4 transition-colors hover:underline"
                      >
                        {row.patient_name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {when.format(new Date(row.starts_at))}
                    </TableCell>
                    <TableCell>{row.doctor_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ring-1 ring-inset",
                          row.response === "confirmed"
                            ? "status-completed"
                            : row.response === "cancelled"
                              ? "status-cancelled"
                              : row.response === "no_response"
                                ? "status-no-show"
                                : "status-held",
                        )}
                      >
                        {RESPONSE_LABEL[row.response] ?? row.response}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
