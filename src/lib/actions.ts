"use server";

/**
 * The write path: browser form to Server Action to API.
 *
 * The browser never calls the Python API. It cannot: the API sends no CORS
 * headers and requires a loopback Host, both deliberate. A Server Action runs
 * in this Node process, so it can, and that keeps those two protections intact
 * instead of reaching around them.
 *
 * It also means patient data never crosses to the client except as the field a
 * page chose to render, which is what role-based access will need in M5.
 *
 * Every action returns a result object rather than throwing. A form needs to
 * show a receptionist what happened — "that time is taken, pick another" — and
 * an exception crossing the Server Action boundary arrives in the browser as a
 * generic digest with the message stripped, which is no use to anybody.
 */

import { revalidatePath } from "next/cache";

import {
  ApiError,
  bookAppointment,
  cancelAppointment,
  confirmHold,
  rescheduleAppointment,
  resolveEscalation,
} from "@/lib/api";
import {
  correctRow,
  findSlots,
  runConversationTurn,
  type ConversationTurn,
  type Slot,
} from "@/lib/api-import";
import { currentClinic } from "@/lib/clinic";

/** What a form gets back. `ok: false` always carries something to display. */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; requestId?: string };

/**
 * Turn a thrown error into a sentence a receptionist can act on.
 *
 * 409 is the one that matters: the scheduling routes use it to mean another
 * patient committed that time first, so the request was fine and the answer is
 * simply no. The API's own Spanish detail is preferred when it sent one,
 * because it is more specific than anything generic here — it names the
 * expired hold, or the appointment that does not exist.
 */
function failure(error: unknown, fallback: string): ActionResult {
  if (error instanceof ApiError) {
    const detail = typeof error.message === "string" ? error.message : "";
    console.error(`[action] ${detail}`);
    return {
      ok: false,
      message: error.spanish,
      requestId: error.requestId,
    };
  }
  console.error(`[action] ${error instanceof Error ? error.message : String(error)}`);
  return { ok: false, message: fallback };
}

/**
 * Combine a date and a time from a form into an instant with Colombia's offset.
 *
 * The API refuses a time with no offset, and rightly: a naive time leaves the
 * zone to be guessed. The form collects what a receptionist reads off the wall
 * clock, and the offset is added here rather than in the browser, because a
 * staff laptop set to another zone would otherwise book the wrong hour.
 *
 * Colombia is UTC-5 year round with no daylight saving, so the offset is fixed.
 * If the product ever serves a zone that observes DST, this becomes a lookup
 * rather than a constant.
 */
function colombianInstant(date: string, time: string): string {
  return `${date}T${time}:00-05:00`;
}

/** Read one required field from a form, or explain which one is missing. */
function required(form: FormData, name: string, label: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "") {
    throw new MissingField(`Falta ${label}.`);
  }
  return value;
}

class MissingField extends Error {
  readonly spanish: string;
  constructor(spanish: string) {
    super(spanish);
    this.name = "MissingField";
    this.spanish = spanish;
  }
}

export async function book(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const typeId = required(form, "appointment_type_id", "el tipo de cita");
    const minutes = Number(form.get("duration_minutes"));
    if (!Number.isInteger(minutes) || minutes < 1) {
      return { ok: false, message: "La duración de la cita no es válida." };
    }

    const appointment = await bookAppointment(clinic.id, {
      patient_id: required(form, "patient_id", "el paciente"),
      doctor_id: required(form, "doctor_id", "el médico"),
      location_id: required(form, "location_id", "la sede"),
      appointment_type_id: typeId,
      start: colombianInstant(
        required(form, "date", "la fecha"),
        required(form, "time", "la hora"),
      ),
      duration_minutes: minutes,
      // The form's own idempotency key. A double-clicked submit, or a retry
      // after a dropped connection, returns the first appointment rather than
      // creating a second one for the same patient.
      idempotency_key: `form-${form.get("patient_id")}-${form.get("date")}-${form.get("time")}`,
    });

    revalidatePath("/appointments");
    revalidatePath("/");
    return {
      ok: true,
      message: `Cita agendada para ${appointment.patient_name} con ${appointment.doctor_name}.`,
    };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    return failure(error, "No se pudo agendar la cita.");
  }
}

export async function cancel(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const id = required(form, "appointment_id", "la cita");
    const reason = form.get("reason");
    await cancelAppointment(
      clinic.id,
      id,
      typeof reason === "string" && reason.trim() !== "" ? reason : undefined,
    );

    revalidatePath("/appointments");
    revalidatePath("/");
    return { ok: true, message: "Cita cancelada. El horario quedó libre." };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    return failure(error, "No se pudo cancelar la cita.");
  }
}

export async function confirm(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const id = required(form, "appointment_id", "la reserva");
    const appointment = await confirmHold(clinic.id, id);

    revalidatePath("/appointments");
    revalidatePath("/");
    return {
      ok: true,
      message: `Reserva confirmada para ${appointment.patient_name}.`,
    };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    // A lapsed hold answers 409, and the API's own Spanish says so: its slot
    // was free in the meantime and may belong to somebody else now.
    return failure(error, "No se pudo confirmar la reserva.");
  }
}

export async function reschedule(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const id = required(form, "appointment_id", "la cita");
    const minutes = Number(form.get("duration_minutes"));
    if (!Number.isInteger(minutes) || minutes < 1) {
      return { ok: false, message: "La duración de la cita no es válida." };
    }

    const moved = await rescheduleAppointment(clinic.id, id, {
      start: colombianInstant(
        required(form, "date", "la nueva fecha"),
        required(form, "time", "la nueva hora"),
      ),
      duration_minutes: minutes,
    });

    revalidatePath("/appointments");
    revalidatePath("/");
    return {
      ok: true,
      // Said plainly, because the id changes: the engine cancels the old row
      // and writes a new one linked to it, which is what the history needs.
      message: `Cita reprogramada. Es un registro nuevo (${moved.id.slice(0, 8)}), con el anterior cancelado.`,
    };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    return failure(error, "No se pudo reprogramar la cita.");
  }
}

export async function resolve(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const id = required(form, "escalation_id", "el pendiente");
    await resolveEscalation(clinic.id, id);

    revalidatePath("/escalations");
    revalidatePath("/");
    return { ok: true, message: "Pendiente marcado como resuelto." };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    return failure(error, "No se pudo marcar como resuelto.");
  }
}

/**
 * Find the times a doctor can actually offer.
 *
 * A read rather than a write, but it goes through an action because the form
 * is interactive: a page cannot call the API, and the alternative would be a
 * round trip through the URL on every search.
 */
export async function searchSlots(
  form: FormData,
): Promise<{ ok: true; slots: Slot[] } | { ok: false; message: string }> {
  try {
    const clinic = await currentClinic();
    const doctorId = required(form, "doctor_id", "el médico");
    const typeId = required(form, "appointment_type_id", "el tipo de cita");
    const earliest = form.get("earliest");
    const latest = form.get("latest");

    const slots = await findSlots(clinic.id, {
      doctor_id: doctorId,
      appointment_type_id: typeId,
      start_date: required(form, "start_date", "la fecha inicial"),
      end_date: required(form, "end_date", "la fecha final"),
      earliest: typeof earliest === "string" && earliest !== "" ? earliest : undefined,
      latest: typeof latest === "string" && latest !== "" ? latest : undefined,
      limit: 60,
    });
    return { ok: true, slots };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    const result = failure(error, "No se pudieron buscar los horarios.");
    return { ok: false, message: result.message };
  }
}

/** Answer one cell of a row the importer could not convert on its own. */
export async function correctImportRow(form: FormData): Promise<ActionResult> {
  try {
    const clinic = await currentClinic();
    const sessionId = required(form, "session_id", "la importación");
    const sheet = required(form, "sheet", "la hoja");
    const rowNumber = Number(form.get("row_number"));
    if (!Number.isInteger(rowNumber)) {
      return { ok: false, message: "El número de fila no es válido." };
    }

    // Keyed by the canonical field, and only the cells that were filled in:
    // sending an empty one would overwrite a value the reviewer left alone.
    const cells: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("cell.") && typeof value === "string" && value !== "") {
        cells[key.slice("cell.".length)] = value;
      }
    }
    if (Object.keys(cells).length === 0) {
      return { ok: false, message: "No hay nada que corregir." };
    }

    await correctRow(clinic.id, sessionId, {
      sheet,
      row_number: rowNumber,
      cells,
    });

    revalidatePath(`/import/${sessionId}/rows`);
    revalidatePath(`/import/${sessionId}`);
    return { ok: true, message: "Fila corregida." };
  } catch (error) {
    if (error instanceof MissingField) {
      return { ok: false, message: error.spanish };
    }
    return failure(error, "No se pudo corregir la fila.");
  }
}

/**
 * Run one conversation turn through the graph (M3).
 *
 * Returns the whole turn, not a message: the screen is a review surface and
 * needs the drafts and the gate's findings, which is the only way to see that
 * nothing refused was sent.
 *
 * Nothing is revalidated. A turn can change an appointment — confirming or
 * cancelling one — but the simulator exists to show the pipeline rather than
 * to drive the diary, and revalidating the whole layout on every keystroke of
 * a demo would be noise. A reviewer checking the effect opens /appointments.
 */
export async function simulateTurn(
  form: FormData,
): Promise<ActionResult & { turn?: ConversationTurn }> {
  try {
    const clinic = await currentClinic();
    const turn = await runConversationTurn(clinic.id, {
      sender_phone: required(form, "sender_phone", "el número"),
      text: String(form.get("text") ?? ""),
    });
    return { ok: true, message: "", turn };
  } catch (error) {
    return failure(error, "No se pudo procesar el mensaje.");
  }
}
