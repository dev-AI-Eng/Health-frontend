import Link from "next/link";

import { listAppointments } from "@/lib/api";
import { cancel, confirm, reschedule } from "@/lib/actions";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton, WhenForm } from "@/components/forms";
import { intlLocale, translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens
 * the page the patients that existed when it was built. Marking the route
 * dynamic is the correctness requirement here, not a performance trade.
 */
export const dynamic = "force-dynamic";



/**
 * An appointment's time, as the clinic reads it.
 *
 * The API sends ISO 8601 carrying Colombia's -05:00 offset, so the instant is
 * unambiguous. It is formatted with that same zone rather than the viewer's,
 * because a receptionist means the time on the clinic wall.
 */
const whenFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
    timeZone: "America/Bogota",
  });

/**
 * Statuses a receptionist can still act on. A completed, cancelled, missed or
 * already-rescheduled appointment is history: the engine refuses to cancel it,
 * so offering the button would be offering a refusal.
 */
const ACTIONABLE = new Set(["hold", "scheduled", "confirmed", "checked_in"]);

/** The date and time inputs want these shapes, in the clinic's own zone. */
const DATE_PART = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
const TIME_PART = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function AppointmentsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const WHEN = whenFormatter(intlLocale(locale));
  const head = [
    t("appointments.col.when"),
    t("appointments.col.patient"),
    t("appointments.col.doctor"),
    t("appointments.col.site"),
    t("appointments.col.status"),
    t("appointments.col.actions"),
  ];
  const result = await load("appointments", (clinic) =>
    listAppointments(clinic.id, { limit: 50 }),
  );
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title={t("appointments.title")}
          subtitle={`${page.total.toLocaleString(intlLocale(locale))} ${t("appointments.total")} · ${t("appointments.showing")} ${page.items.length}`}
        />
        <Link
          href="/appointments/new"
          className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
        >
          {t("appointments.new")}
        </Link>
      </div>

      <Card>
        {page.items.length === 0 ? (
          <Empty>{t("appointments.empty")}</Empty>
        ) : (
          <Table head={head}>
            {page.items.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap">
                  <div className="font-medium">{WHEN.format(new Date(appointment.start))}</div>
                  <div className="text-xs text-slate-500">
                    {appointment.duration_minutes} min · {appointment.appointment_type}
                  </div>
                </Td>
                <Td>{appointment.patient_name}</Td>
                <Td>
                  <div>{appointment.doctor_name}</div>
                  <div className="text-xs text-slate-500">{appointment.specialty}</div>
                </Td>
                <Td className="text-slate-600">{appointment.location_name}</Td>
                <Td>
                  <StatusBadge status={appointment.status} locale={locale} />
                  {/* A hold is a live offer, so when it lapses decides whether
                      the slot is really taken. Nothing else carries an expiry. */}
                  {appointment.expires_at ? (
                    <div className="mt-1 text-xs text-amber-700">
                      {t("appointments.expires")} {WHEN.format(new Date(appointment.expires_at))}
                    </div>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap align-top">
                  {ACTIONABLE.has(appointment.status) ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {appointment.status === "hold" ? (
                          <ActionButton
                            action={confirm}
                            fields={{ appointment_id: appointment.id }}
                            label={t("action.confirm")}
                            pendingLabel={t("action.confirming")}
                          />
                        ) : null}
                        <ActionButton
                          action={cancel}
                          fields={{ appointment_id: appointment.id }}
                          label={t("action.cancel")}
                          pendingLabel={t("action.cancelling")}
                          confirm={t("confirm.cancelAppointment")}
                          tone="danger"
                        />
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                          {t("action.reschedule")}
                        </summary>
                        <WhenForm
                          action={reschedule}
                          hidden={{ appointment_id: appointment.id }}
                          submitLabel={t("action.move")}
                          pendingLabel={t("action.moving")}
                          defaultDate={DATE_PART.format(new Date(appointment.start))}
                          defaultTime={TIME_PART.format(new Date(appointment.start))}
                          durationMinutes={appointment.duration_minutes}
                        />
                      </details>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
