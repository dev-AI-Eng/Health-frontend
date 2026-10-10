import { listEscalations } from "@/lib/api";
import { resolve } from "@/lib/actions";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { intlLocale, translator, type CopyKey, type T } from "@/lib/i18n";
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
 * The reason code is translated; the sentence beside it (`detail_es`) is not,
 * because the API composes it with a date and a time and re-deriving it here
 * would mean two sources of the same wording. See `i18n.ts`.
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

const whenFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
    timeZone: "America/Bogota",
  });

export default async function EscalationsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const WHEN = whenFormatter(intlLocale(locale));
  const result = await load("escalations", (clinic) =>
    listEscalations(clinic.id, { limit: 100 }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const open = page.items.filter((e) => e.status === "open");
  const done = page.items.filter((e) => e.status === "resolved");

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
      <Card className="mb-6 border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-sm text-slate-700">
          {t("pending.explainer")}
        </p>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <Empty>{t("pending.empty")}</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...open, ...done].map((item) => (
            <Card
              key={item.id}
              className={`px-5 py-4 ${item.status === "open" ? "border-amber-200" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        item.status === "open"
                          ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                          : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                      }
                    >
                      {item.status === "open" ? t("pending.open") : t("pending.resolved")}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {reasonLabel(item.reason, t)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {WHEN.format(new Date(item.created_at))}
                    </span>
                  </div>

                  {/* The sentence written for a receptionist. The whole reason
                      the row exists, so it is the largest thing on the card. */}
                  <p className="mt-2 text-sm text-slate-900">{item.detail_es}</p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.patient_name
                      ? `${t("pending.patient")}: ${item.patient_name}`
                      : t("pending.noPatient")}
                    {item.resolved_at
                      ? ` · ${t("pending.resolvedAt")} ${WHEN.format(new Date(item.resolved_at))}`
                      : ""}
                  </p>
                </div>

                {item.status === "open" ? (
                  <div className="shrink-0">
                    <ActionButton
                      action={resolve}
                      fields={{ escalation_id: item.id }}
                      label={t("action.resolve")}
                      pendingLabel={t("action.saving")}
                      confirm={t("confirm.resolve")}
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
