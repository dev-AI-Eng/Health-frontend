import Link from "next/link";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { RowCorrection, RowStatus } from "@/components/row-review";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { correctImportRow } from "@/lib/actions";
import { getImportSession, listImportRows } from "@/lib/api-import";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the rows change as a reviewer corrects them. */
export const dynamic = "force-dynamic";

export default async function ImportRowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; sheet?: string }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  const locale = await currentLocale();
  const t = translator(locale);
  const status = query.status ?? "review";

  const result = await load("import/rows", async (clinic) => {
    const [session, rows] = await Promise.all([
      getImportSession(clinic.id, sessionId),
      listImportRows(clinic.id, sessionId, {
        status,
        sheet: query.sheet,
        limit: 200,
      }),
    ]);
    return { session, rows };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { session, rows } = result.data;

  const FILTERS = [
    { value: "review", label: t("import.review") },
    { value: "invalid", label: t("import.invalid") },
    { value: "valid", label: t("import.valid") },
  ];

  /** Which sheet a row belongs to. One sheet is the common case. */
  const sheet = query.sheet ?? session.sheets[0]?.sheet ?? "";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/import/${sessionId}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("import.backToImport")}
      </Link>

      <PageHeading title={t("rows.title")} subtitle={t("rows.subtitle")} />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/import/${sessionId}/rows?status=${filter.value}${
              query.sheet ? `&sheet=${encodeURIComponent(query.sheet)}` : ""
            }`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              status === filter.value
                ? "border-primary bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {/* Several sheets: a workbook is often eight, one of which is a
          documentation page rather than records. */}
      {session.sheets.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {session.sheets.map((s) => (
            <Link
              key={s.sheet}
              href={`/import/${sessionId}/rows?status=${status}&sheet=${encodeURIComponent(s.sheet)}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                sheet === s.sheet
                  ? "border-primary bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {s.sheet}
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty icon={<CheckCircle2 className="size-5" />}>{t("import.noRows")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">{t("import.rowNumber")}</TableHead>
                  <TableHead>{t("import.rowStatus")}</TableHead>
                  <TableHead>{t("rows.values")}</TableHead>
                  <TableHead>{t("import.rowReason")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.row_number}>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {row.row_number}
                    </TableCell>
                    <TableCell>
                      <RowStatus
                        status={row.status}
                        label={
                          row.status === "valid"
                            ? t("import.valid")
                            : row.status === "review"
                              ? t("import.review")
                              : t("import.invalid")
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs font-mono text-xs">
                      {Object.entries(row.values)
                        .filter(([, value]) => value)
                        .slice(0, 3)
                        .map(([key, value]) => `${key}=${value}`)
                        .join("  ")}
                    </TableCell>
                    <TableCell className="max-w-sm text-xs">
                      {[...row.errors, ...row.reviews].map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                      {row.errors.length === 0 && row.reviews.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status !== "valid" ? (
                        <RowCorrection
                          action={correctImportRow}
                          sessionId={sessionId}
                          sheet={sheet}
                          row={row}
                          labels={{
                            correct: t("rows.correct"),
                            correcting: t("rows.correcting"),
                            title: t("import.rowNumber"),
                            hint: t("rows.correctHint"),
                            cancel: t("common.keep"),
                          }}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t("rows.correctHint")}
      </p>
    </div>
  );
}
