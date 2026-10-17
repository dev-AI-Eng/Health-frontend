"use client";

/**
 * The manager panel's presentation.
 *
 * One idea runs through all of it: **a number without its basis is worse than
 * no number**. So every rate renders its formula, a null rate says "not enough
 * data" instead of 0%, a suppressed group says it was suppressed, and a
 * punctuality average always carries the coverage it rests on.
 *
 * That is not decoration. A manager who sees "no-show 0%" for a clinic with no
 * appointments will believe attendance is perfect, and one who sees "12 minutes
 * late on average" without knowing it came from 4 of 90 appointments will
 * believe it about the doctor.
 */

import { AlertTriangle, EyeOff, Info } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CancellationReason,
  Funnel,
  PunctualityRow,
  ZoneReport,
} from "@/lib/api-import";

/** A funnel step. Plain numbers, large, because they are read at a glance. */
export function FunnelGrid({
  funnel,
  labels,
}: {
  funnel: Funnel;
  labels: Record<keyof Funnel, string>;
}) {
  const order: (keyof Funnel)[] = [
    "offered",
    "scheduled",
    "confirmed",
    "rescheduled",
    "cancelled",
    "no_show",
    "completed",
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {order.map((key) => (
        <Card key={key} className="py-0">
          <CardContent className="px-4 py-3.5">
            <p className="text-muted-foreground text-xs">{labels[key]}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{funnel[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * One rate, with the formula that produced it.
 *
 * `value === null` renders the no-data message rather than 0%. Those are
 * different facts and conflating them is how a clinic with an empty month
 * reads as a clinic with perfect attendance.
 */
export function RateCard({
  label,
  value,
  formula,
  noData,
}: {
  label: string;
  value: number | null;
  formula: string;
  noData: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3.5">
        <p className="text-muted-foreground text-xs">{label}</p>
        {value === null ? (
          <p className="text-muted-foreground mt-1 text-sm">{noData}</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}%</p>
        )}
        {/* Printed, not linked or tooltipped: Rev3 requires the formula on the
            report, and a tooltip is not on the report. */}
        <p className="text-muted-foreground mt-1.5 font-mono text-[0.65rem] leading-tight">
          {formula}
        </p>
      </CardContent>
    </Card>
  );
}

export function CancellationTable({
  rows,
  labels,
}: {
  rows: CancellationReason[];
  labels: { reason: string; actor: string; count: string; actorNames: Record<string, string> };
}) {
  if (rows.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{labels.reason}</TableHead>
          <TableHead>{labels.actor}</TableHead>
          <TableHead className="text-right">{labels.count}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.reason}-${row.actor}`}>
            <TableCell className="font-mono text-xs">{row.reason}</TableCell>
            <TableCell>
              {/* Who cancelled is its own column: "patients cancel 30%" and
                  "we cancel 30%" are different problems with different
                  answers, and one number hides which. */}
              <Badge variant="secondary">{labels.actorNames[row.actor] ?? row.actor}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The geographic view: a table and a bar, no map.
 *
 * Rev3 excludes a map and a distance calculation, and the reason is worth
 * keeping in view: a map of patients by neighbourhood is a re-identification
 * surface, while the clinic's actual question — "where are we losing people" —
 * is answered by a sorted table.
 */
export function ZoneTable({
  report,
  labels,
}: {
  report: ZoneReport;
  labels: {
    municipality: string;
    neighborhood: string;
    appointments: string;
    noShow: string;
    suppressed: string;
    suppressedCount: string;
    noZoneData: string;
    hint: string;
  };
}) {
  const named = report.rows.filter(
    (row) => row.municipality_divipola !== null || row.neighborhood !== null,
  );
  const worst = Math.max(1, ...report.rows.map((row) => row.no_show_pct ?? 0));

  return (
    <div>
      <p className="text-muted-foreground mb-3 flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {labels.hint}
      </p>

      {named.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noZoneData}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{labels.municipality}</TableHead>
              <TableHead>{labels.neighborhood}</TableHead>
              <TableHead className="text-right">{labels.appointments}</TableHead>
              <TableHead>{labels.noShow}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row, index) => (
              <TableRow key={`${row.municipality_divipola}-${row.neighborhood}-${index}`}>
                <TableCell className="font-mono text-xs">
                  {row.municipality_divipola ?? "—"}
                </TableCell>
                <TableCell>{row.neighborhood ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.appointments}</TableCell>
                <TableCell>
                  {row.suppressed ? (
                    <Badge variant="secondary" className="gap-1">
                      <EyeOff className="size-3" />
                      {labels.suppressed}
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right text-sm tabular-nums">
                        {row.no_show_pct}%
                      </span>
                      {/* A bar rather than a chart library: one number per
                          row, and the comparison is between rows. */}
                      <span
                        aria-hidden
                        className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
                      >
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width: `${((row.no_show_pct ?? 0) / worst) * 100}%` }}
                        />
                      </span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {report.suppressed_groups > 0 ? (
        <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" />
          {labels.suppressedCount.replace("{n}", String(report.suppressed_groups))}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Punctuality, with coverage beside every average.
 *
 * The coverage badge turns amber below half, because that is the point at
 * which the average stops describing the doctor and starts describing who
 * remembers to press buttons.
 */
export function PunctualityTable({
  rows,
  labels,
}: {
  rows: PunctualityRow[];
  labels: {
    doctor: string;
    startDelay: string;
    overrun: string;
    coverage: string;
    minutes: string;
    notRecorded: string;
    hint: string;
    noData: string;
  };
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-3 flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {labels.hint}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noData}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{labels.doctor}</TableHead>
              <TableHead className="text-right">{labels.startDelay}</TableHead>
              <TableHead className="text-right">{labels.overrun}</TableHead>
              <TableHead>{labels.coverage}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.doctor_id}>
                <TableCell className="font-medium">{row.doctor_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.mean_start_delay_minutes === null ? (
                    <span className="text-muted-foreground text-xs">{labels.notRecorded}</span>
                  ) : (
                    `${row.mean_start_delay_minutes} ${labels.minutes}`
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.mean_overrun_minutes === null ? (
                    <span className="text-muted-foreground text-xs">{labels.notRecorded}</span>
                  ) : (
                    `${row.mean_overrun_minutes} ${labels.minutes}`
                  )}
                </TableCell>
                <TableCell>
                  <Coverage
                    recorded={row.recorded_start}
                    total={row.total}
                    pct={row.start_coverage_pct}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Coverage({
  recorded,
  total,
  pct,
}: {
  recorded: number;
  total: number;
  pct: number | null;
}) {
  // Amber below half: that is where the average stops being about the doctor.
  const thin = pct !== null && pct < 50;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {thin ? <AlertTriangle className="size-3 shrink-0" /> : null}
      <span className={cn("tabular-nums", thin && "font-medium")}>
        {recorded}/{total}
      </span>
      {pct === null ? null : (
        <span className="text-muted-foreground">({pct}%)</span>
      )}
    </span>
  );
}
