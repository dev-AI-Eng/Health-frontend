"use client";

/**
 * The upload step.
 *
 * A drop zone rather than a bare file input, because the thing a receptionist
 * has is a file in a folder and dragging it is the shortest path. The input is
 * still there and still labelled, so the keyboard route works too.
 *
 * Nothing is written by uploading: the file is read, a mapping is proposed, and
 * the reviewer is taken to the screen where they confirm it. That separation is
 * M1's whole point, and the copy says so before anybody drops a file.
 */

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ImportSession } from "@/lib/api-import";
import type { ImportResult } from "@/lib/import-actions";

export interface UploadLabels {
  drop: string;
  formats: string;
  choose: string;
  reading: string;
}

export function ImportUpload({
  action,
  labels,
}: {
  action: (form: FormData) => Promise<ImportResult<ImportSession>>;
  labels: UploadLabels;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();

  const send = (file: File) => {
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const result = await action(form);
      if (result.ok) {
        // Straight to the mapping screen: reading a file and then leaving the
        // reviewer on the upload page would make them hunt for what happened.
        router.push(`/import/${result.data.session_id}`);
      } else {
        toast.warning(result.message, {
          description: result.requestId ? `ref: ${result.requestId}` : undefined,
        });
      }
    });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) send(file);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        over ? "border-primary bg-accent/50" : "border-border",
        pending && "opacity-70",
      )}
    >
      <span className="bg-accent text-accent-foreground mx-auto mb-4 grid size-12 place-items-center rounded-xl">
        {pending ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-6" />
        )}
      </span>

      <p className="font-medium">{pending ? labels.reading : labels.drop}</p>
      <p className="text-muted-foreground mt-1 text-sm">{labels.formats}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        aria-label={labels.choose}
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="mt-5"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {labels.choose}
      </Button>
    </div>
  );
}
