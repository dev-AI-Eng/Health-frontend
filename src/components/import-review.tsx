"use client";

/**
 * The confirmation screen: where a person approves what the importer proposed.
 *
 * This is M1's deliverable. Four things have to be visible and actionable:
 *
 *  - which field each of the clinic's columns became, and why,
 *  - what the file could not settle, phrased as a question with both answers,
 *  - how much of each column actually converts, over every row rather than a
 *    sample, because a preview of the first five looks fine while row 100 is
 *    broken,
 *  - and that nothing is written until the last button.
 *
 * A column's field is a Select rather than free text: a model may propose a
 * mapping, but the set of fields is fixed in the backend, and letting somebody
 * type one would invite a field that does not exist.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CanonicalField,
  ImportCommit,
  ImportSession,
  ImportSheet,
  ImportValidation,
} from "@/lib/api-import";
import type { ImportResult } from "@/lib/import-actions";

export interface ReviewLabels {
  colColumn: string;
  colField: string;
  colQuality: string;
  colWhy: string;
  unmapped: string;
  ignore: string;
  entity: string;
  skipSheet: string;
  save: string;
  saving: string;
  missingRequired: string;
  percentValid: string;
  questions: string;
  questionsHint: string;
  ifApproved: string;
  ifDeclined: string;
  approve: string;
  decline: string;
  answered: string;
  columnQuestions: string;
  validate: string;
  validating: string;
  blocking: string;
  tolerated: string;
  valid: string;
  review: string;
  invalid: string;
  rows: string;
  commit: string;
  committing: string;
  committed: string;
  created: string;
  updated: string;
  skipped: string;
  conflicts: string;
  nothingWritten: string;
  viewRows: string;
}

type SessionAction = (form: FormData) => Promise<ImportResult<ImportSession>>;

/** How a column's match was arrived at, in the reviewer's language. */
function confidenceTone(confidence: string): string {
  if (confidence === "confirmed") return "status-confirmed";
  if (confidence === "exact" || confidence === "strong") return "status-scheduled";
  if (confidence === "model") return "status-rescheduled";
  return "status-held";
}

/** A percentage, coloured by whether it needs attention. */
function Quality({ sheet, column, label }: { sheet: ImportSheet; column: { percent_valid?: number; review?: number; invalid?: number }; label: string }) {
  if (column.percent_valid === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const pct = Math.round(column.percent_valid);
  const perfect = pct === 100;
  return (
    <span className="flex items-center gap-2" title={label}>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          perfect
            ? "text-emerald-700 dark:text-emerald-300"
            : pct >= 90
              ? "text-amber-700 dark:text-amber-300"
              : "text-rose-700 dark:text-rose-300",
        )}
      >
        {pct}%
      </span>
      {!perfect && (column.review ?? 0) + (column.invalid ?? 0) > 0 ? (
        <span className="text-muted-foreground text-xs">
          {(column.review ?? 0) + (column.invalid ?? 0)} / {sheet.total_rows}
        </span>
      ) : null}
    </span>
  );
}

export function ImportReview({
  session,
  fields,
  labels,
  sessionId,
  correctMapping,
  answerStructure,
  validate,
  commit,
}: {
  session: ImportSession;
  fields: CanonicalField[];
  labels: ReviewLabels;
  sessionId: string;
  correctMapping: SessionAction;
  answerStructure: SessionAction;
  validate: (form: FormData) => Promise<ImportResult<ImportValidation>>;
  commit: (form: FormData) => Promise<ImportResult<ImportCommit>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [committed, setCommitted] = useState<ImportCommit | null>(null);

  /** Local edits per sheet, so a reviewer can change several and save once. */
  const [edits, setEdits] = useState<Record<string, Record<string, string | null>>>({});
  const [decisions, setDecisions] = useState<Record<string, Record<string, string>>>({});

  const structureQuestions = session.structure_questions ?? [];
  const unanswered = structureQuestions.filter((q) => q.answered === null || q.answered === undefined);

  const fieldFor = (sheet: string, column: string, fallback: string | null) =>
    edits[sheet]?.[column] !== undefined ? edits[sheet][column] : fallback;

  const run = <T,>(
    action: (form: FormData) => Promise<ImportResult<T>>,
    form: FormData,
    onOk?: (data: T) => void,
  ) =>
    start(async () => {
      const result = await action(form);
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onOk?.(result.data);
        router.refresh();
      } else {
        toast.warning(result.message, {
          description: result.requestId ? `ref: ${result.requestId}` : undefined,
        });
      }
    });

  return (
    <div className="space-y-6">
      {/* Questions about how to read the file come first and block everything
          else: answering them re-parses the bytes, so a mapping confirmed
          before they are answered could be a mapping of the wrong rows. */}
      {structureQuestions.length > 0 ? (
        <Card className={unanswered.length > 0 ? "border-amber-200 dark:border-amber-900/60" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="size-4" />
              {labels.questions}
            </CardTitle>
            <p className="text-muted-foreground text-sm">{labels.questionsHint}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {structureQuestions.map((question) => {
              const done = question.answered === true || question.answered === false;
              return (
                <div
                  key={question.id}
                  className={cn(
                    "rounded-lg border p-4",
                    done ? "bg-muted/40" : "bg-amber-50/50 dark:bg-amber-950/20",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-2">
                        {question.sheet}
                      </Badge>
                      <p className="text-sm font-medium">{question.finding}</p>
                      <dl className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">{labels.ifApproved}</dt>
                          <dd>{question.if_approved}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{labels.ifDeclined}</dt>
                          <dd>{question.if_declined}</dd>
                        </div>
                      </dl>
                    </div>

                    {done ? (
                      <Badge className="status-confirmed shrink-0 ring-1 ring-inset">
                        {labels.answered}
                      </Badge>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        {(["true", "false"] as const).map((approved) => (
                          <Button
                            key={approved}
                            type="button"
                            size="sm"
                            variant={approved === "true" ? "default" : "outline"}
                            disabled={pending}
                            onClick={() => {
                              const form = new FormData();
                              form.set("session_id", sessionId);
                              form.set("question_id", question.id);
                              form.set("approved", approved);
                              run(answerStructure, form);
                            }}
                          >
                            {approved === "true" ? labels.approve : labels.decline}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* One card per sheet. A clinic's workbook is often eight of them, and
          one of those is usually a documentation page rather than records. */}
      {session.sheets.map((sheet) => {
        const sheetEdits = edits[sheet.sheet] ?? {};
        const sheetDecisions = decisions[sheet.sheet] ?? {};
        const dirty =
          Object.keys(sheetEdits).length > 0 || Object.keys(sheetDecisions).length > 0;
        const relevant = fields.filter((f) => f.entity === sheet.entity);

        return (
          <Card key={sheet.sheet}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">{sheet.sheet}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {sheet.total_rows} {labels.rows} · {sheet.entity_reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`entity-${sheet.sheet}`} className="sr-only">
                    {labels.entity}
                  </Label>
                  <Select
                    value={sheetEdits.__entity ?? sheet.entity}
                    onValueChange={(value) =>
                      setEdits((prev) => ({
                        ...prev,
                        [sheet.sheet]: { ...(prev[sheet.sheet] ?? {}), __entity: value },
                      }))
                    }
                    disabled={pending}
                  >
                    <SelectTrigger id={`entity-${sheet.sheet}`} className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["patient", "doctor", "specialty", "appointment", "availability"].map(
                        (entity) => (
                          <SelectItem key={entity} value={entity}>
                            {entity}
                          </SelectItem>
                        ),
                      )}
                      {/* Skipping is how a stale sheet left in the workbook is
                          dealt with, and it has to be as easy as mapping one. */}
                      <SelectItem value="skip">{labels.skipSheet}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {sheet.missing_required.length > 0 ? (
                <p className="mt-2 flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {labels.missingRequired}: {sheet.missing_required.join(", ")}
                </p>
              ) : null}

              {sheet.questions.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-lg bg-amber-50/60 p-3 dark:bg-amber-950/20">
                  <p className="text-xs font-medium">{labels.columnQuestions}</p>
                  {sheet.questions.map((question) => (
                    <p key={question} className="text-sm">
                      {question}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{labels.colColumn}</TableHead>
                      <TableHead className="w-56">{labels.colField}</TableHead>
                      <TableHead>{labels.colQuality}</TableHead>
                      <TableHead>{labels.colWhy}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.columns.map((column) => (
                      <TableRow key={column.column}>
                        <TableCell className="font-mono text-xs font-medium">
                          {column.column}
                        </TableCell>
                        <TableCell>
                          <Label htmlFor={`f-${sheet.sheet}-${column.column}`} className="sr-only">
                            {labels.colField}
                          </Label>
                          <Select
                            value={fieldFor(sheet.sheet, column.column, column.target_field) ?? "__none"}
                            onValueChange={(value) =>
                              setEdits((prev) => ({
                                ...prev,
                                [sheet.sheet]: {
                                  ...(prev[sheet.sheet] ?? {}),
                                  [column.column]: value === "__none" ? null : value,
                                },
                              }))
                            }
                            disabled={pending}
                          >
                            <SelectTrigger
                              id={`f-${sheet.sheet}-${column.column}`}
                              className="w-full"
                            >
                              <SelectValue placeholder={labels.unmapped} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">{labels.ignore}</SelectItem>
                              {relevant.map((field) => (
                                <SelectItem key={field.name} value={field.name}>
                                  {field.name}
                                  {field.requirement === "required" ? " *" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Quality sheet={sheet} column={column} label={labels.percentValid} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs text-xs">
                          <Badge
                            variant="secondary"
                            className={cn("mr-2 ring-1 ring-inset", confidenceTone(column.confidence))}
                          >
                            {column.confidence}
                          </Badge>
                          {column.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {dirty ? (
                <Button
                  type="button"
                  className="mt-4"
                  disabled={pending}
                  onClick={() => {
                    const mapping: Record<string, string | null> = {};
                    for (const column of sheet.columns) {
                      mapping[column.column] = fieldFor(
                        sheet.sheet,
                        column.column,
                        column.target_field,
                      );
                    }
                    delete (mapping as Record<string, unknown>).__entity;

                    const form = new FormData();
                    form.set("session_id", sessionId);
                    form.set("sheet", sheet.sheet);
                    form.set("mapping", JSON.stringify(mapping));
                    form.set("decisions", JSON.stringify(sheetDecisions));
                    const entity = sheetEdits.__entity;
                    if (entity) form.set("entity", entity);

                    run(correctMapping, form, () => {
                      setEdits((prev) => ({ ...prev, [sheet.sheet]: {} }));
                      setDecisions((prev) => ({ ...prev, [sheet.sheet]: {} }));
                    });
                  }}
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {labels.saving}
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      {labels.save}
                    </>
                  )}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {/* Validate, then commit. Two buttons rather than one, because the whole
          guarantee is that a person sees what will happen before it does. */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={validation ? "outline" : "default"}
              disabled={pending || unanswered.length > 0}
              onClick={() => {
                const form = new FormData();
                form.set("session_id", sessionId);
                run(validate, form, setValidation);
              }}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {labels.validating}
                </>
              ) : (
                labels.validate
              )}
            </Button>

            {validation ? (
              <Button
                type="button"
                disabled={pending || !validation.can_commit}
                onClick={() => {
                  const form = new FormData();
                  form.set("session_id", sessionId);
                  run(commit, form, setCommitted);
                }}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {labels.committing}
                  </>
                ) : (
                  <>
                    {labels.commit}
                    <ChevronRight className="size-4" />
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {validation ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {validation.sheets.map((sheet) => (
                  <span key={sheet.sheet} className="flex items-center gap-2">
                    <span className="font-medium">{sheet.sheet}</span>
                    <span className="text-emerald-700 tabular-nums dark:text-emerald-300">
                      {sheet.valid_rows} {labels.valid}
                    </span>
                    {sheet.review_rows > 0 ? (
                      <span className="text-amber-700 tabular-nums dark:text-amber-300">
                        {sheet.review_rows} {labels.review}
                      </span>
                    ) : null}
                    {sheet.invalid_rows > 0 ? (
                      <span className="text-rose-700 tabular-nums dark:text-rose-300">
                        {sheet.invalid_rows} {labels.invalid}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>

              {/* Exactly what `commit` will refuse on. The milestone's exit
                  criterion, so it is shown verbatim rather than summarised. */}
              {validation.blocking.length > 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="size-4" />
                    {labels.blocking}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {validation.blocking.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {labels.nothingWritten}
                  </p>
                </div>
              ) : null}

              {validation.tolerated && validation.tolerated.length > 0 ? (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Info className="size-4" />
                    {labels.tolerated}
                  </p>
                  <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                    {validation.tolerated.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {committed ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/25">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" />
                {labels.committed}
              </p>
              <p className="mt-1 text-sm">{committed.message}</p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {(
                  [
                    [labels.created, committed.created],
                    [labels.updated, committed.updated],
                    [labels.skipped, committed.skipped],
                  ] as const
                ).map(([label, counts]) =>
                  counts && Object.values(counts).some((n) => n > 0) ? (
                    <div key={label} className="flex gap-1.5">
                      <dt className="text-muted-foreground">{label}:</dt>
                      <dd className="tabular-nums">
                        {Object.entries(counts)
                          .filter(([, n]) => n > 0)
                          .map(([sheet, n]) => `${sheet} ${n}`)
                          .join(" · ")}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {committed.conflicts && committed.conflicts.length > 0 ? (
                <div className="mt-3">
                  <p className="text-sm font-medium">{labels.conflicts}</p>
                  <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                    {committed.conflicts.map((conflict) => (
                      <li key={conflict}>{conflict}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
