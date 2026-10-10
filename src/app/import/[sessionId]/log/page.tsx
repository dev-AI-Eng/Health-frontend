import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";
import { cn } from "cn";

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
import { listTransformLog } from "@/lib/api-import";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the log changes as a reviewer answers questions. */
export const dynamic = "force-dynamic";

/**
 * The transform log: every converted cell and the rule that produced it.
 *
 * M1's audit evidence, and the answer to "why did this become that". The value
 * the clinic's file held is shown beside the value it became, which is the
 * pairing that makes a refusal checkable rather than a complaint.
 *
 * Filterable because a 2,000-row file holds 2,000 cells and a handful of
 * causes: the interesting view is `review` and `invalid`.
 */
export default async function TransformLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ sessionId }, { status }] = await Promise.all([params, searchParams]);
  const locale = await currentLocale();
  const t = translator(locale);

  const result = await load("import/log", (clinic) =>
    listTransformLog(clinic.id, sessionId, { status, limit: 500 }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const cells = result.data;

  const FILTERS: { value?: string; label: string }[] = [
    { value: undefined, label: t("log.all") },
    { value: "review", label: t("import.review") },
    { value: "invalid", label: t("import.invalid") },
    { value: "valid", label: t("import.valid") },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/import/${sessionId}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("import.backToImport")}
      </Link>

      <PageHeading title={t("log.title")} subtitle={t("log.subtitle")} />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = status === filter.value || (!status && !filter.value);
          return (
            <Link
              key={filter.label}
              href={
                filter.value
                  ? `/import/${sessionId}/log?status=${filter.value}`
                  : `/import/${sessionId}/log`
              }
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden py-0">
        {cells.length === 0 ? (
          <Empty icon={<FileSearch className="size-5" />}>{t("log.empty")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">{t("import.rowNumber")}</TableHead>
                  <TableHead>{t("import.col.column")}</TableHead>
                  <TableHead>{t("log.raw")}</TableHead>
                  <TableHead>{t("log.became")}</TableHead>
                  <TableHead>{t("log.rule")}</TableHead>
                  <TableHead>{t("log.whatToDo")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cells.map((cell, index) => (
                  <TableRow key={`${cell.row_number}-${cell.column}-${index}`}>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {cell.row_number}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cell.column}</TableCell>
                    {/* The clinic's own value, never overwritten by a
                        reviewer's answer: the log is evidence of what arrived. */}
                    <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                      {cell.raw || <span className="text-muted-foreground">—</span>}
                      {cell.corrected_from_review ? (
                        <span className="text-muted-foreground ml-1.5">
                          → {cell.corrected_from_review}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                      {cell.normalized ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ring-1 ring-inset font-mono text-[11px]",
                          cell.status === "valid"
                            ? "status-completed"
                            : cell.status === "review"
                              ? "status-held"
                              : "status-no-show",
                        )}
                      >
                        {cell.rule}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm text-xs">
                      {cell.message ? <p>{cell.message}</p> : null}
                      {/* The guidance: what this refusal means and what to do.
                          Written for a receptionist, not a stack trace. */}
                      {cell.action ? (
                        <p className="text-muted-foreground mt-1">{cell.action}</p>
                      ) : null}
                      {!cell.message && !cell.action ? (
                        <span className="text-muted-foreground">—</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
