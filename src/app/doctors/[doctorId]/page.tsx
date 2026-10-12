import Link from "next/link";
import { ArrowLeft, CalendarCheck, CalendarOff, CalendarPlus, Info } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, PageHeading, Stat } from "@/components/page";
import { SlotFinder } from "@/components/slot-finder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { searchSlots } from "@/lib/actions";
import { listAppointmentTypes } from "@/lib/api";
import { getDoctor } from "@/lib/api-import";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the schedule and the diary both change under it. */
export const dynamic = "force-dynamic";

/** Today and a fortnight out, as the date inputs want them. */
function range(): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
  const today = new Date();
  const later = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: fmt.format(today), to: fmt.format(later) };
}

export default async function DoctorPage({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;
  const locale = await currentLocale();
  const t = translator(locale);

  const result = await load("doctors/detail", async (clinic) => {
    const [doctor, types] = await Promise.all([
      getDoctor(clinic.id, doctorId),
      listAppointmentTypes(clinic.id),
    ]);
    return { doctor, types };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { doctor, types } = result.data;
  const { from, to } = range();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/doctors"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("doctor.back")}
      </Link>

      <PageHeading
        title={doctor.full_name}
        subtitle={doctor.specialty || undefined}
        action={
          <Badge
            variant="secondary"
            className={cn(
              "ring-1 ring-inset",
              doctor.active ? "status-confirmed" : "status-cancelled",
            )}
          >
            {doctor.active ? t("doctors.active") : t("doctors.inactive")}
          </Badge>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("doctor.upcoming")}
          value={doctor.upcoming_active_appointments}
          icon={<CalendarCheck className="size-4" />}
        />
        <Stat
          label={t("doctor.schedule")}
          value={doctor.availability_rules.length}
          icon={<CalendarPlus className="size-4" />}
        />
        <Stat
          label={t("doctor.exceptions")}
          value={doctor.availability_exceptions.length}
          icon={<CalendarOff className="size-4" />}
          tone={doctor.availability_exceptions.length > 0 ? "attention" : "default"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("doctor.schedule")}</CardTitle>
          {/* The decision stated where somebody can see its consequence: these
              rules are the source, and the slots below are derived from them
              every time rather than stored. */}
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t("doctor.scheduleHint")}
          </p>
        </CardHeader>
        <CardContent>
          {doctor.availability_rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("doctor.noRules")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {doctor.availability_rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-medium capitalize">{rule.weekday_name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {rule.start_time.slice(0, 5)} – {rule.end_time.slice(0, 5)}
                    {rule.valid_until ? (
                      <span className="ml-2 text-xs">
                        ({t("slots.to").toLowerCase()} {rule.valid_until})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("doctor.exceptions")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("doctor.exceptionsHint")}</p>
        </CardHeader>
        <CardContent>
          {doctor.availability_exceptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("doctor.noExceptions")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {doctor.availability_exceptions.map((exception) => (
                <li
                  key={exception.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-medium tabular-nums">{exception.on_date}</span>
                  <span className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ring-1 ring-inset",
                        exception.kind === "unavailable"
                          ? "status-cancelled"
                          : "status-confirmed",
                      )}
                    >
                      {exception.kind === "unavailable"
                        ? t("doctor.unavailable")
                        : t("doctor.extraHours")}
                    </Badge>
                    <span className="text-muted-foreground tabular-nums">
                      {exception.start_time && exception.end_time
                        ? `${exception.start_time.slice(0, 5)} – ${exception.end_time.slice(0, 5)}`
                        : t("doctor.allDay")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mb-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("slots.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("slots.subtitle")}</p>
      </div>

      {/* The doctor is fixed by the page, so it travels as a prop and the
          finder puts it in the form rather than offering a picker that could
          only have one answer. */}
      <SlotFinder
          action={searchSlots}
          doctorId={doctorId}
          types={types.map((type) => ({
            id: type.id,
            name: type.name,
            durationMinutes: type.duration_minutes,
          }))}
          defaultFrom={from}
          defaultTo={to}
          minutesLabel={t("book.minutes")}
          labels={{
            from: t("slots.from"),
            to: t("slots.to"),
            type: t("slots.type"),
            earliest: t("slots.earliest"),
            latest: t("slots.latest"),
            search: t("slots.search"),
            searching: t("slots.searching"),
            found: t("slots.found"),
            none: t("slots.none"),
            anyHour: t("slots.anyHour"),
          }}
      />
    </div>
  );
}
