import Link from "next/link";
import { CalendarDays, CalendarPlus } from "lucide-react";

import { ApiFailure, Empty, PageHeading, StatusBadge } from "@/components/page";
import { ConfirmAction, RescheduleDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancel, confirm, reschedule } from "@/lib/actions";
import { listAppointments } from "@/lib/api";
import { intlLocale, translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the diary changes as staff book and cancel. */
export const dynamic = "force-dynamic";

/**
 * Statuses a receptionist can still act on.
 *
 * A completed, cancelled, missed or already-rescheduled appointment is
 * history: the engine refuses to cancel it, so offering the button would be
 * offering a refusal.
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
  const result = await load("appointments", (clinic) =>
    listAppointments(clinic.id, { limit: 50 }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const nf = new Intl.NumberFormat(intlLocale(locale));

  /**
   * The appointment's time, as the clinic reads it.
   *
   * Formatted in Bogotá rather than the viewer's zone: a receptionist means
   * the time on the clinic wall, and a laptop set to another zone would
   * otherwise show a different hour than the patient was told.
   */
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
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
        title={t("appointments.title")}
        subtitle={`${nf.format(page.total)} ${t("appointments.total")} · ${t("appointments.showing")} ${page.items.length}`}
        action={
          <Button asChild>
            <Link href="/appointments/new">
              <CalendarPlus className="size-4" />
              {t("appointments.new")}
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden py-0">
        {page.items.length === 0 ? (
          <Empty icon={<CalendarDays className="size-5" />}>{t("appointments.empty")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("appointments.col.when")}</TableHead>
                  <TableHead>{t("appointments.col.patient")}</TableHead>
                  <TableHead>{t("appointments.col.doctor")}</TableHead>
                  <TableHead>{t("appointments.col.site")}</TableHead>
                  <TableHead>{t("appointments.col.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("appointments.col.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((appointment) => {
                  const start = new Date(appointment.start);
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{when.format(start)}</div>
                        <div className="text-muted-foreground text-xs">
                          {appointment.duration_minutes} {t("book.minutes")} ·{" "}
                          {appointment.appointment_type}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {appointment.patient_name}
                      </TableCell>
                      <TableCell>
                        <div>{appointment.doctor_name}</div>
                        <div className="text-muted-foreground text-xs">
                          {appointment.specialty}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {appointment.location_name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={appointment.status} locale={locale} />
                        {/* A hold is a live offer, so when it lapses decides
                            whether the slot is really taken. */}
                        {appointment.expires_at ? (
                          <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            {t("appointments.expires")}{" "}
                            {when.format(new Date(appointment.expires_at))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {ACTIONABLE.has(appointment.status) ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {appointment.status === "hold" ? (
                              <ConfirmAction
                                action={confirm}
                                fields={{ appointment_id: appointment.id }}
                                label={t("action.confirm")}
                                pendingLabel={t("action.confirming")}
                                title={t("confirmHold.title")}
                                description={`${appointment.patient_name} · ${when.format(start)}`}
                                confirmLabel={t("confirmHold.confirm")}
                                cancelLabel={t("common.keep")}
                              />
                            ) : null}
                            <RescheduleDialog
                              action={reschedule}
                              appointmentId={appointment.id}
                              durationMinutes={appointment.duration_minutes}
                              defaultDate={DATE_PART.format(start)}
                              defaultTime={TIME_PART.format(start)}
                              labels={{
                                trigger: t("action.reschedule"),
                                title: t("reschedule.title"),
                                description: `${appointment.patient_name} · ${when.format(start)}`,
                                date: t("book.date"),
                                time: t("book.time"),
                                submit: t("action.move"),
                                submitting: t("action.moving"),
                                cancel: t("common.keep"),
                              }}
                            />
                            {/* The dialog names the patient and the time, which
                                `window.confirm` could not: the point is knowing
                                which of fifty rows is about to change. */}
                            <ConfirmAction
                              action={cancel}
                              fields={{ appointment_id: appointment.id }}
                              label={t("action.cancel")}
                              pendingLabel={t("action.cancelling")}
                              title={t("cancel.title")}
                              description={`${appointment.patient_name} · ${when.format(start)} · ${appointment.doctor_name}`}
                              confirmLabel={t("cancel.confirm")}
                              cancelLabel={t("common.keep")}
                              destructive
                            />
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-right text-xs">—</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
