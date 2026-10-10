/**
 * Page-level building blocks, shared by every screen.
 *
 * Server components: none of these hold state, so none of them needs to be
 * shipped to the browser.
 */

import type { ReactNode } from "react";
import { AlertTriangle, EyeOff, Inbox, ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type Locale, translator } from "@/lib/i18n";

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  /** A primary action for this screen, right-aligned on a wide viewport. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * A single number worth reading at a glance.
 *
 * The number is large and the label small, rather than the reverse: somebody
 * scanning this is looking for the value, and already knows what they came for.
 */
export function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Highlights a figure that means somebody has to do something. */
  tone?: "default" | "attention";
}) {
  return (
    <Card className={cn(tone === "attention" && "border-amber-200 dark:border-amber-900/60")}>
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        {icon ? (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              tone === "attention"
                ? "status-held ring-1 ring-inset"
                : "bg-accent text-accent-foreground",
            )}
          >
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** What a page shows when the API could not answer. */
export function ApiFailure({
  detail,
  requestId,
  locale = "es",
}: {
  detail: string;
  requestId?: string;
  locale?: Locale;
}) {
  const t = translator(locale);
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex gap-3">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">{t("error.title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{detail}</p>
          {requestId ? (
            <p className="text-muted-foreground mt-2 font-mono text-xs">
              {t("error.reference")}: {requestId}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Nothing here yet. An icon and a sentence, not a blank panel. */
export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="text-muted-foreground max-w-sm text-sm">{children}</p>
    </div>
  );
}

/**
 * Says whether the identifiers on this screen are masked, and why.
 *
 * Shown on every screen that renders a document number or a phone. A
 * receptionist seeing `******8842` should know that is masking rather than bad
 * data, and an administrator seeing a full cédula should know the view was
 * recorded — before they look, not after.
 */
export function MaskNotice({ masked, locale }: { masked: boolean; locale: Locale }) {
  const t = translator(locale);
  return (
    <Card
      className={cn(
        "mb-6",
        masked ? "bg-muted/40" : "border-teal-200 bg-teal-50/60 dark:border-teal-900 dark:bg-teal-950/30",
      )}
    >
      <CardContent className="flex items-start gap-3 py-1">
        {masked ? (
          <EyeOff className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        ) : (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300" />
        )}
        <div className="min-w-0 text-sm">
          <span className="font-medium">
            {masked ? t("mask.masked") : t("mask.unmasked")}
          </span>{" "}
          <span className="text-muted-foreground">
            {masked ? t("mask.maskedHint") : t("mask.unmaskedHint")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** The engine's eight statuses, each with its own fixed colour. */
const STATUS_UTILITY: Record<string, string> = {
  hold: "status-held",
  scheduled: "status-scheduled",
  confirmed: "status-confirmed",
  checked_in: "status-checked-in",
  completed: "status-completed",
  no_show: "status-no-show",
  cancelled: "status-cancelled",
  rescheduled: "status-rescheduled",
};

const STATUS_KEYS = Object.keys(STATUS_UTILITY);

export function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  const t = translator(locale);
  // An unknown status shows its raw value rather than nothing: a status the
  // engine added and this file has not learned should be visible, not hidden.
  const label = STATUS_KEYS.includes(status)
    ? t(`status.${status}` as Parameters<typeof t>[0])
    : status;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "ring-1 ring-inset",
        STATUS_UTILITY[status] ?? "bg-muted text-muted-foreground ring-border",
      )}
    >
      {label}
    </Badge>
  );
}
