import { listAppointmentTypes, listDoctors, listLocations, listPatients } from "@/lib/api";
import { book } from "@/lib/actions";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading } from "@/components/ui";
import { BookingForm } from "@/components/forms";

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
    return <ApiFailure detail={result.spanish} requestId={result.requestId} />;
  }
  const { patients, doctors, locations, types } = result.data;

  const missing =
    locations.length === 0
      ? "No hay sedes registradas."
      : types.length === 0
        ? "No hay tipos de cita registrados."
        : patients.items.length === 0
          ? "No hay pacientes. Importe un archivo para empezar."
          : null;

  return (
    <>
      <PageHeading
        title="Nueva cita"
        subtitle="El horario se reserva al guardar; si otro paciente lo toma primero, se le avisa."
      />

      <Card className="px-5 py-5">
        {missing ? (
          <Empty>{missing}</Empty>
        ) : (
          <BookingForm
            action={book}
            defaultDate={todayInBogota()}
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
            types={types.map((t) => ({
              id: t.id,
              label: t.name,
              durationMinutes: t.duration_minutes,
            }))}
          />
        )}
      </Card>

      <p className="mt-4 text-sm text-slate-500">
        Las citas se guardan en la zona horaria de Colombia (UTC−5).
      </p>
    </>
  );
}
