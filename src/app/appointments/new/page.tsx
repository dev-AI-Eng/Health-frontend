import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { BookingForm } from "@/components/forms";
import { Card, CardContent } from "@/components/ui/card";
import {
  listAppointmentTypes,
  listDoctors,
  listLocations,
  listPatients,
} from "@/lib/api";
import { book } from "@/lib/actions";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the pickers list live patients and doctors. */
export const dynamic = "force-dynamic";

/** Today in Bogotá, as the date input wants it. A clinic books from today. */
function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export default async function NewAppointmentPage() {
  const locale = await currentLocale();
  const t = translator(locale);

  const result = await load("appointments/new", async (clinic) => {
    // In parallel: none of them depends on another.
    const [patients, doctors, locations, types] = await Promise.all([
      listPatients(clinic.id, { limit: 200 }),
      listDoctors(clinic.id, { limit: 100 }),
      listLocations(clinic.id),
      listAppointmentTypes(clinic.id),
    ]);
    return { patients, doctors, locations, types };
  });

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const { patients, doctors, locations, types } = result.data;

  const missing =
    locations.length === 0
      ? t("book.noSites")
      : types.length === 0
        ? t("book.noTypes")
        : patients.items.length === 0
          ? t("book.noPatients")
          : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/appointments"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("appointments.title")}
      </Link>

      <PageHeading title={t("book.title")} subtitle={t("book.subtitle")} />

      <Card>
        <CardContent>
          {missing ? (
            <Empty>{missing}</Empty>
          ) : (
            <BookingForm
              action={book}
              defaultDate={todayInBogota()}
              labels={{
                patient: t("book.patient"),
                doctor: t("book.doctor"),
                site: t("book.site"),
                type: t("book.type"),
                date: t("book.date"),
                time: t("book.time"),
                select: t("book.select"),
                minutes: t("book.minutes"),
                submit: t("action.book"),
                submitting: t("action.booking"),
              }}
              patients={patients.items.map((p) => ({
                id: p.id,
                label: `${p.given_names} ${p.family_names}`,
                hint: `${p.document_type} ${p.document_number_masked}`,
              }))}
              // Only doctors who still take appointments. An inactive doctor
              // keeps their history, so they appear on the list but not here.
              doctors={doctors.items
                .filter((d) => d.active)
                .map((d) => ({
                  id: d.id,
                  label: d.full_name,
                  hint: d.specialty || undefined,
                }))}
              locations={locations.map((l) => ({ id: l.id, label: l.name }))}
              types={types.map((type) => ({
                id: type.id,
                label: type.name,
                durationMinutes: type.duration_minutes,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-sm">
        <Clock className="size-3.5" />
        {t("book.timezoneNote")}
      </p>
    </div>
  );
}
