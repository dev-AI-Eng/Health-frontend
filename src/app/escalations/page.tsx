import { listEscalations } from "@/lib/api";
import { resolve } from "@/lib/actions";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading } from "@/components/ui";
import { ActionButton } from "@/components/forms";

/**
 * Rendered per request, never prerendered.
 *
 * This is a work queue: a cached copy would show a receptionist items somebody
 * else has already dealt with.
 */
export const dynamic = "force-dynamic";

/** Why the system handed this to a person, in the clinic's language. */
const REASONS: Record<string, string> = {
  no_acceptable_slot: "Sin horario disponible",
  attendance_unrecorded: "Asistencia sin registrar",
  missing_consent: "Falta consentimiento",
  unrecognised_sender: "Remitente desconocido",
  clinical_concern: "Posible tema clínico",
  evaluator_exhausted: "Revisión automática agotada",
  patient_asked_for_a_human: "El paciente pidió hablar con alguien",
};

const WHEN = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Bogota",
});

export default async function EscalationsPage() {
  const result = await load("escalations", (clinic) =>
    listEscalations(clinic.id, { limit: 100 }),
  );

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} />;
  }
  const page = result.data;
  const open = page.items.filter((e) => e.status === "open");
  const done = page.items.filter((e) => e.status === "resolved");

  return (
    <>
      <PageHeading
        title="Pendientes"
        subtitle={
          open.length === 0
            ? "Nada pendiente."
            : `${open.length} ${open.length === 1 ? "cosa" : "cosas"} por atender`
        }
      />

      {/* Said plainly, because it is the point of the queue: the system stops
          rather than guessing, and a person decides. */}
      <Card className="mb-6 border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-sm text-slate-700">
          Aquí llega todo lo que el sistema no debe resolver solo: una cita que no
          se pudo ofrecer, o una asistencia que nadie registró. Nada se borra de
          esta lista — se marca como resuelto y queda el registro.
        </p>
      </Card>

      {page.items.length === 0 ? (
        <Card>
          <Empty>No hay pendientes.</Empty>
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
                      {item.status === "open" ? "pendiente" : "resuelto"}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {REASONS[item.reason] ?? item.reason}
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
                      ? `Paciente: ${item.patient_name}`
                      : "Sin paciente identificado"}
                    {item.resolved_at
                      ? ` · resuelto ${WHEN.format(new Date(item.resolved_at))}`
                      : ""}
                  </p>
                </div>

                {item.status === "open" ? (
                  <div className="shrink-0">
                    <ActionButton
                      action={resolve}
                      fields={{ escalation_id: item.id }}
                      label="Marcar resuelto"
                      pendingLabel="Guardando…"
                      confirm="¿Marcar este pendiente como resuelto?"
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
