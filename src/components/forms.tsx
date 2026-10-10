"use client";

/**
 * The interactive pieces: forms that call a Server Action and show the answer.
 *
 * These are the only client components in the app. Everything else renders on
 * the server, so patient data reaches the browser only as the fields a page
 * chose to show.
 *
 * Each form holds the action's result in state and renders it, because the
 * answer is often the point: "that time is taken, pick another" is information
 * a receptionist acts on, not an error to swallow. A pending state is shown for
 * the same reason — a booking that looks like it did nothing gets submitted
 * twice, and while the idempotency key makes that harmless, confusing somebody
 * is still a defect.
 */

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions";

type Action = (form: FormData) => Promise<ActionResult>;

/** The outcome banner. Green for done, amber for refused. */
function Outcome({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  const tone = result.ok
    ? "border-teal-200 bg-teal-50 text-teal-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${tone}`} role="status">
      {result.message}
      {!result.ok && result.requestId ? (
        <div className="mt-1 font-mono text-xs opacity-70">
          referencia: {result.requestId}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A button that submits one hidden-field form through an action.
 *
 * Used for the single-click operations — cancel, resolve — where a whole form
 * would be more ceremony than the action deserves.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  confirm,
  tone = "neutral",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  /** Asked before the action runs. Cancelling an appointment is not undoable. */
  confirm?: string;
  tone?: "neutral" | "danger";
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const classes =
    tone === "danger"
      ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          const form = new FormData();
          for (const [key, value] of Object.entries(fields)) form.set(key, value);
          start(async () => setResult(await action(form)));
        }}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${classes}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {result ? (
        <div
          className={`mt-1 text-xs ${result.ok ? "text-teal-700" : "text-amber-700"}`}
          role="status"
        >
          {result.message}
        </div>
      ) : null}
    </>
  );
}

/**
 * A date-and-time form, used for rescheduling.
 *
 * `<input type="date">` and `type="time"` rather than a picker library: the
 * browser's own controls already speak the user's locale, handle the keyboard
 * and work on a phone, which is more than a hand-rolled one would.
 */
export function WhenForm({
  action,
  hidden,
  submitLabel,
  pendingLabel,
  defaultDate,
  defaultTime,
  durationMinutes,
}: {
  action: Action;
  hidden: Record<string, string>;
  submitLabel: string;
  pendingLabel: string;
  defaultDate?: string;
  defaultTime?: string;
  durationMinutes: number;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(form) => start(async () => setResult(await action(form)))}
      className="mt-2 flex flex-wrap items-end gap-2"
    >
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="duration_minutes" value={durationMinutes} />
      <label className="text-xs text-slate-600">
        <span className="block">Fecha</span>
        <input
          type="date"
          name="date"
          defaultValue={defaultDate}
          required
          className="mt-0.5 rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-slate-600">
        <span className="block">Hora</span>
        <input
          type="time"
          name="time"
          defaultValue={defaultTime}
          required
          step={300}
          className="mt-0.5 rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <div className="w-full">
        <Outcome result={result} />
      </div>
    </form>
  );
}

/** One option in a picker. */
export interface Choice {
  id: string;
  label: string;
  hint?: string;
}

/**
 * The new-appointment form.
 *
 * Duration follows the appointment type rather than being typed: how long a
 * consultation takes is the clinic's decision, and letting a receptionist set
 * it is how a 20-minute appointment ends up in a 10-minute slot.
 */
export function BookingForm({
  action,
  patients,
  doctors,
  locations,
  types,
  defaultDate,
}: {
  action: Action;
  patients: Choice[];
  doctors: Choice[];
  locations: Choice[];
  types: (Choice & { durationMinutes: number })[];
  defaultDate: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");

  const duration =
    types.find((t) => t.id === typeId)?.durationMinutes ?? types[0]?.durationMinutes ?? 20;

  const field = "mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm";

  return (
    <form
      action={(form) => start(async () => setResult(await action(form)))}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="text-sm">
        <span className="font-medium text-slate-700">Paciente</span>
        <select name="patient_id" required className={field} defaultValue="">
          <option value="" disabled>
            Seleccione…
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.hint ? ` · ${p.hint}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="font-medium text-slate-700">Médico</span>
        <select name="doctor_id" required className={field} defaultValue="">
          <option value="" disabled>
            Seleccione…
          </option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
              {d.hint ? ` · ${d.hint}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="font-medium text-slate-700">Sede</span>
        <select name="location_id" required className={field} defaultValue={locations[0]?.id}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="font-medium text-slate-700">Tipo de cita</span>
        <select
          name="appointment_type_id"
          required
          className={field}
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} · {t.durationMinutes} min
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="font-medium text-slate-700">Fecha</span>
        <input type="date" name="date" required defaultValue={defaultDate} className={field} />
      </label>

      <label className="text-sm">
        <span className="font-medium text-slate-700">Hora</span>
        <input type="time" name="time" required step={300} defaultValue="09:00" className={field} />
      </label>

      {/* Follows the selected type, so the engine is told the clinic's own
          duration rather than whatever a form happened to carry. */}
      <input type="hidden" name="duration_minutes" value={duration} />

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Agendando…" : `Agendar (${duration} min)`}
        </button>
        <Outcome result={result} />
      </div>
    </form>
  );
}
