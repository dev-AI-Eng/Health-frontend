import { listDoctors } from "@/lib/api";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading, Table, Td } from "@/components/ui";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens
 * the page the patients that existed when it was built. Marking the route
 * dynamic is the correctness requirement here, not a performance trade.
 */
export const dynamic = "force-dynamic";

const HEAD = ["Médico", "Especialidad", "Estado"] as const;

export default async function DoctorsPage() {
  const result = await load("doctors", (clinic) =>
    listDoctors(clinic.id, { limit: 100 }),
  );
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} />;
  }
  const page = result.data;

  return (
    <>
      <PageHeading
        title="Médicos"
        subtitle={`${page.total.toLocaleString("es-CO")} en total`}
      />

      <Card>
        {page.items.length === 0 ? (
          <Empty>Todavía no hay médicos registrados.</Empty>
        ) : (
          <Table head={HEAD}>
            {page.items.map((doctor) => (
              <tr key={doctor.id} className="hover:bg-slate-50">
                <Td className="font-medium">{doctor.full_name}</Td>
                <Td className="text-slate-600">{doctor.specialty || "—"}</Td>
                <Td>
                  {/* An inactive doctor keeps their history but takes no new
                      appointments, so the distinction matters on this screen. */}
                  <span
                    className={
                      doctor.active
                        ? "inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200"
                        : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200"
                    }
                  >
                    {doctor.active ? "activo" : "inactivo"}
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
