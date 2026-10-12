"use client";

/**
 * Reviewing one row of an import, and answering what it could not settle.
 *
 * The transform log shows every cell and the rule that produced it. This shows
 * the other axis: a row, why it needs a person, and the ability to answer it.
 *
 * Without this, a single malformed cédula in a 2,000-row export means asking
 * the clinic for a new file. With it, a receptionist fixes the one cell.
 *
 * The file's original value stays in the log either way — the answer is stored
 * beside it rather than over it, because the log's job is to record what
 * arrived, not what somebody wished had arrived.
 */

import { useState, useTransition } from "react";
import { Check, Loader2, PencilLine } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImportRow } from "@/lib/api-import";
import type { ActionResult } from "@/lib/actions";

export interface RowLabels {
  correct: string;
  correcting: string;
  title: string;
  hint: string;
  cancel: string;
}

export function RowCorrection({
  action,
  sessionId,
  sheet,
  row,
  labels,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  sessionId: string;
  sheet: string;
  row: ImportRow;
  labels: RowLabels;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const fields = Object.keys(row.values);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine className="size-3.5" />
        {labels.correct}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {labels.title} {row.row_number}
            </DialogTitle>
            <DialogDescription>{labels.hint}</DialogDescription>
          </DialogHeader>

          <form
            action={(form) =>
              start(async () => {
                const result = await action(form);
                if (result.ok) {
                  toast.success(result.message, { icon: <Check className="size-4" /> });
                  setOpen(false);
                } else {
                  toast.warning(result.message);
                }
              })
            }
            className="grid gap-4"
          >
            <input type="hidden" name="session_id" value={sessionId} />
            <input type="hidden" name="sheet" value={sheet} />
            <input type="hidden" name="row_number" value={row.row_number} />

            {/* Every reason this row needs a person, so the reviewer is not
                guessing which cell to change. */}
            {row.reviews.length > 0 || row.errors.length > 0 ? (
              <ul className="bg-muted/50 space-y-1 rounded-lg p-3 text-xs">
                {[...row.errors, ...row.reviews].map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}

            <div className="grid max-h-72 gap-3 overflow-y-auto">
              {fields.map((field) => (
                <div key={field} className="grid gap-1.5">
                  <Label htmlFor={`cell-${row.row_number}-${field}`} className="font-mono text-xs">
                    {field}
                  </Label>
                  <Input
                    id={`cell-${row.row_number}-${field}`}
                    name={`cell.${field}`}
                    defaultValue={row.values[field] ?? ""}
                    disabled={pending}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {labels.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {labels.correcting}
                  </>
                ) : (
                  labels.correct
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The row's state, coloured the way the import screens colour everything. */
export function RowStatus({ status, label }: { status: string; label: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "ring-1 ring-inset",
        status === "valid"
          ? "status-completed"
          : status === "review"
            ? "status-held"
            : "status-no-show",
      )}
    >
      {label}
    </Badge>
  );
}
