/**
 * The handful of pieces every page needs.
 *
 * Deliberately small. A design system is worth building when there are enough
 * screens to be inconsistent across; right now four pages share a card, a
 * table and a way of saying something went wrong.
 */
import type { ReactNode } from "react";

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

/**
 * What a page shows when the API could not answer.
 *
 * `detail` is Spanish and written for whoever is at the clinic; the English
 * technical message went to the server log in `load()`. The request id is
 * shown because it is what matches this screen to that log line, and reading
 * it out over the phone is how a receptionist reports a problem.
 */
export function ApiFailure({
  title = "No se pudo cargar la información",
  detail,
  requestId,
}: {
  title?: string;
  detail: string;
  requestId?: string;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50 px-5 py-4">
      <p className="font-medium text-rose-900">{title}</p>
      <p className="mt-1 text-sm text-rose-800">{detail}</p>
      {requestId ? (
        <p className="mt-2 font-mono text-xs text-rose-700">request id: {requestId}</p>
      ) : null}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export function Table({ head, children }: { head: readonly string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {head.map((label) => (
              <th
                key={label}
                className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3 ${className}`}>{children}</td>;
}

/** Appointment statuses, in the Spanish a receptionist reads. */
const STATUS_ES: Record<string, string> = {
  hold: "reservado",
  scheduled: "agendada",
  confirmed: "confirmada",
  checked_in: "en sala",
  completed: "atendida",
  no_show: "no asistió",
  cancelled: "cancelada",
  rescheduled: "reprogramada",
};

/** Colour carries the same meaning the engine gives a status, not decoration. */
const STATUS_TONE: Record<string, string> = {
  hold: "bg-amber-50 text-amber-800 ring-amber-200",
  scheduled: "bg-sky-50 text-sky-800 ring-sky-200",
  confirmed: "bg-teal-50 text-teal-800 ring-teal-200",
  checked_in: "bg-teal-50 text-teal-800 ring-teal-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  no_show: "bg-rose-50 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
  rescheduled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {STATUS_ES[status] ?? status}
    </span>
  );
}
