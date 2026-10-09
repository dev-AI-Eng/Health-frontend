import { listAppointments } from "@/lib/api";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading, StatusBadge, Table, Td } from "@/components/ui";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens
 * the page the patients that existed when it was built. Marking the route
 * dynamic is the correctness requirement here, not a performance trade.
 */
export const dynamic = "force-dynamic";

const HEAD = ["Cuándo", "Paciente", "Médico", "Sede", "Estado"] as const;

/**
 * An appointment's time, as the clinic reads it.
 *
 * The API sends ISO 8601 carrying Colombia's -05:00 offset, so the instant is
 * unambiguous. It is formatted with that same zone rather than the viewer's,
 * because a receptionist means the time on the clinic wall.
 */
const WHEN = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Bogota",
});

export default async function AppointmentsPage() {
  const result = await load("appointments", (clinic) =>
    listAppointments(clinic.id, { limit: 50 }),
  );
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} />;
  }
  const page = result.data;

  return (
    <>
      <PageHeading
        title="Citas"
        subtitle={`${page.total.toLocaleString("es-CO")} en total · mostrando ${page.items.length}`}
      />

      <Card>
        {page.items.length === 0 ? (
          <Empty>Todavía no hay citas agendadas.</Empty>
        ) : (
          <Table head={HEAD}>
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
                  <StatusBadge status={appointment.status} />
                  {/* A hold is a live offer, so when it lapses decides whether
                      the slot is really taken. Nothing else carries an expiry. */}
                  {appointment.expires_at ? (
                    <div className="mt-1 text-xs text-amber-700">
                      vence {WHEN.format(new Date(appointment.expires_at))}
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
