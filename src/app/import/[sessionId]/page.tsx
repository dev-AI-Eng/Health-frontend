import Link from "next/link";
import { ArrowLeft, FileSearch, FileSpreadsheet, ListChecks } from "lucide-react";

import { ApiFailure, PageHeading } from "@/components/page";
import { ImportReview } from "@/components/import-review";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getImportSession, listCanonicalFields } from "@/lib/api-import";
import { answerStructure, commit, correctMapping, validate } from "@/lib/import-actions";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the session changes as a reviewer answers and saves. */
export const dynamic = "force-dynamic";

export default async function ImportSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const locale = await currentLocale();
  const t = translator(locale);

  const result = await load("import/session", async (clinic) => {
    const [session, fields] = await Promise.all([
      getImportSession(clinic.id, sessionId),
      listCanonicalFields(),
    ]);
    return { session, fields };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { session, fields } = result.data;
  const totalRows = session.sheets.reduce((sum, sheet) => sum + sheet.total_rows, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/import"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("import.backToImport")}
      </Link>

      <PageHeading title={session.filename} subtitle={t("import.subtitle")} />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">{t("import.sheets")}:</span>
            <span className="font-medium tabular-nums">{session.sheets.length}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("import.rows")}:</span>
            <span className="font-medium tabular-nums">{totalRows}</span>
          </span>
          {session.encoding ? (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("import.encoding")}:</span>
              <span className="font-mono text-xs">{session.encoding}</span>
            </span>
          ) : null}
          {session.delimiter ? (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("import.delimiter")}:</span>
              <span className="font-mono text-xs">{session.delimiter}</span>
            </span>
          ) : null}
          {/* The third exit criterion, visible: a file of a known shape needs
              no re-mapping, and this says when that happened. */}
          {session.reused_profiles && session.reused_profiles.length > 0 ? (
            <Badge className="status-confirmed ring-1 ring-inset">
              {t("import.reusedProfile")}: {session.reused_profiles.join(", ")}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {/* The per-cell evidence, one click away: it answers "why did this
          value become that", which is the question a reviewer asks next. */}
      <div className="mb-6 flex flex-wrap gap-5">
        <Link
          href={`/import/${sessionId}/log`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <FileSearch className="size-3.5" />
          {t("log.view")}
        </Link>
        {/* The other axis: the log shows cells, this shows rows and lets a
            reviewer answer one rather than ask for a new file. */}
        <Link
          href={`/import/${sessionId}/rows`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ListChecks className="size-3.5" />
          {t("rows.viewRows")}
        </Link>
      </div>

      <ImportReview
        session={session}
        fields={fields}
        sessionId={sessionId}
        correctMapping={correctMapping}
        answerStructure={answerStructure}
        validate={validate}
        commit={commit}
        labels={{
          colColumn: t("import.col.column"),
          colField: t("import.col.field"),
          colQuality: t("import.col.quality"),
          colWhy: t("import.col.why"),
          unmapped: t("import.unmapped"),
          ignore: t("import.ignore"),
          entity: t("import.entity"),
          skipSheet: t("import.skipSheet"),
          save: t("import.saveMapping"),
          saving: t("import.savingMapping"),
          missingRequired: t("import.missingRequired"),
          percentValid: t("import.percentValid"),
          questions: t("import.questions"),
          questionsHint: t("import.questionsHint"),
          ifApproved: t("import.ifApproved"),
          ifDeclined: t("import.ifDeclined"),
          approve: t("import.approve"),
          decline: t("import.decline"),
          answered: t("import.answered"),
          columnQuestions: t("import.columnQuestions"),
          validate: t("import.validate"),
          validating: t("import.validating"),
          blocking: t("import.blocking"),
          tolerated: t("import.tolerated"),
          valid: t("import.valid"),
          review: t("import.review"),
          invalid: t("import.invalid"),
          rows: t("import.rows"),
          commit: t("import.commit"),
          committing: t("import.committing"),
          committed: t("import.committed"),
          created: t("import.created"),
          updated: t("import.updated"),
          skipped: t("import.skipped"),
          conflicts: t("import.conflicts"),
          nothingWritten: t("import.nothingWritten"),
          viewRows: t("import.viewRows"),
        }}
      />
    </div>
  );
}
