import { listAppointmentTypes, listDoctors, listLocations, listPatients } from "@/lib/api";
import { book } from "@/lib/actions";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading } from "@/components/ui";
import { BookingForm } from "@/components/forms";
import { translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * The pickers list live patients and doctors, so a build-time snapshot would
 * offer whoever opens the page the records that existed when it was built.
 */
export const dynamic = "force-dynamic";

/** Today in Bogotá, as the date input wants it. A clinic books from today. */
function todayInBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export default async function NewAppointmentPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const result = await load("appointments/new", async (clinic) => {
    // One round trip each, in parallel: they do not depend on each other.
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
    <>
      <PageHeading
        title={t("book.title")}
        subtitle={t("book.subtitle")}
      />

      <Card className="px-5 py-5">
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
            // Only doctors who still take appointments. An inactive doctor keeps
            // their history, so they appear on the list page but not here.
            doctors={doctors.items
              .filter((d) => d.active)
              .map((d) => ({ id: d.id, label: d.full_name, hint: d.specialty || undefined }))}
            locations={locations.map((l) => ({ id: l.id, label: l.name }))}
            types={types.map((type) => ({
              id: type.id,
              label: type.name,
              durationMinutes: type.duration_minutes,
            }))}
          />
        )}
      </Card>

      <p className="mt-4 text-sm text-slate-500">
        {t("book.timezoneNote")}
      </p>
    </>
  );
}
