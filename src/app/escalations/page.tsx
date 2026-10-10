import { CheckCircle2, Clock, Inbox, UserX } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { ConfirmAction } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { resolve } from "@/lib/actions";
import { listEscalations } from "@/lib/api";
import { intlLocale, translator, type CopyKey, type T } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * This is a work queue: a cached copy would show a receptionist items somebody
 * else has already dealt with.
 */
export const dynamic = "force-dynamic";

/**
 * Why the system handed this to a person.
 *
 * The reason code is translated; the sentence beside it is not, because the API
 * composes it with a date and a time and re-deriving it here would mean two
 * sources of the same wording. See `i18n.ts`.
 */
const REASONS = [
  "no_acceptable_slot",
  "attendance_unrecorded",
  "missing_consent",
  "unrecognised_sender",
  "clinical_concern",
  "evaluator_exhausted",
  "patient_asked_for_a_human",
] as const;

function reasonLabel(reason: string, t: T): string {
  return (REASONS as readonly string[]).includes(reason)
    ? t(`reason.${reason}` as CopyKey)
    : reason;
}

export default async function EscalationsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const result = await load("escalations", (clinic) =>
    listEscalations(clinic.id, { limit: 100 }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const open = page.items.filter((e) => e.status === "open");
  const done = page.items.filter((e) => e.status === "resolved");

  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });

  return (
    <>
      <PageHeading
        title={t("pending.title")}
        subtitle={
          open.length === 0
            ? t("pending.none")
            : `${open.length} ${open.length === 1 ? t("pending.countOne") : t("pending.countMany")}`
        }
      />

      {/* Said plainly, because it is the point of the queue: the system stops
          rather than guessing, and a person decides. */}
      <Card className="bg-muted/40 mb-6">
        <CardContent className="flex items-start gap-3 py-1">
          <Inbox className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-sm">{t("pending.explainer")}</p>
        </CardContent>
      </Card>

      {page.items.length === 0 ? (
        <Card className="py-0">
          <Empty icon={<CheckCircle2 className="size-5" />}>{t("pending.empty")}</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...open, ...done].map((item) => {
            const isOpen = item.status === "open";
            return (
              <Card
                key={item.id}
                className={cn(
                  isOpen
                    ? "border-amber-200 dark:border-amber-900/60"
                    : "bg-muted/30 opacity-80",
                )}
              >
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ring-1 ring-inset",
                          isOpen ? "status-held" : "status-cancelled",
                        )}
                      >
                        {isOpen ? t("pending.open") : t("pending.resolved")}
                      </Badge>
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {reasonLabel(item.reason, t)}
                      </span>
                      <span className="text-muted-foreground/70 flex items-center gap-1 text-xs">
                        <Clock className="size-3" />
                        {when.format(new Date(item.created_at))}
                      </span>
                    </div>

                    {/* The sentence written for a receptionist, and the whole
                        reason the row exists, so it is the largest thing here. */}
                    <p className="mt-2.5 text-sm">{item.detail_es}</p>

                    <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {item.patient_name ? (
                        <>
                          <span className="font-medium">{t("pending.patient")}:</span>
                          {item.patient_name}
                        </>
                      ) : (
                        <>
                          <UserX className="size-3" />
                          {t("pending.noPatient")}
                        </>
                      )}
                      {item.resolved_at ? (
                        <span className="before:mx-1 before:content-['·']">
                          {t("pending.resolvedAt")} {when.format(new Date(item.resolved_at))}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {isOpen ? (
                    <ConfirmAction
                      action={resolve}
                      fields={{ escalation_id: item.id }}
                      label={t("action.resolve")}
                      pendingLabel={t("action.saving")}
                      title={t("resolve.title")}
                      description={item.detail_es}
                      confirmLabel={t("resolve.confirm")}
                      cancelLabel={t("common.keep")}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
