/**
 * The one place that talks to the Python API.
 *
 * Server-side only. Every function here runs in the Node process, never in the
 * browser, and `import "server-only"` makes that a build error rather than a
 * code review note.
 *
 * Three reasons it has to be this way:
 *
 *  - The API sends no CORS headers, so a browser on :3000 cannot call :8000 at
 *    all. That is deliberate, and adding CORS to reach around it would weaken a
 *    documented defence.
 *  - The API requires a loopback `Host`, which guards against DNS rebinding. A
 *    request from this process carries one; a request from a page does not.
 *  - Patient data must not reach the browser unfiltered. Fetching here means a
 *    page renders only what it chose to show, which is what the dashboard will
 *    need when roles arrive.
 */
import "server-only";

/** Where the Python API listens. Overridden per environment, never per request. */
export const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

/** How long to wait before giving up on the API, in milliseconds. */
export const TIMEOUT_MS = 10_000;

/**
 * A call that did not come back with data.
 *
 * Two messages, deliberately. `message` is English and technical: it names the
 * base URL, the path and the status, and it goes to the server log where a
 * developer reads it. `spanish` is the one sentence a person at the clinic
 * sees, and it never carries a host, a port or a Python command, because none
 * of those mean anything to them and one of them is our internal address.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  /** What the screen says. Spanish, per the product's language rule. */
  readonly spanish: string;
  /** The API's own request id, when it sent one. Logs can be matched on it. */
  readonly requestId?: string;

  // Fields are assigned here rather than declared as constructor parameters so
  // that `node --test` can run this module directly: Node strips types but
  // cannot execute a TypeScript parameter property. Same code, one more line.
  constructor(
    status: number,
    path: string,
    message: string,
    spanish: string,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.spanish = spanish;
    this.requestId = requestId;
  }
}

/**
 * The Spanish sentence for a status the API answered with.
 *
 * Only the statuses this dashboard can actually provoke are worded. Anything
 * else falls through to the generic line rather than being guessed at: a wrong
 * explanation is worse than an honest "try again".
 */
export function spanishFor(status: number, detail?: string): string {
  // 409 and 404 from the scheduling routes carry their own Spanish, written for
  // a receptionist and more specific than anything generic here: "ese horario
  // ya está ocupado", "la reserva ya venció". Discarding it to say "no se pudo
  // obtener la información" was a real defect -- it turned an actionable answer
  // into a shrug. Only a detail that reads as Spanish is used, so an English
  // framework message cannot reach the screen this way.
  if ((status === 409 || status === 404) && detail && looksSpanish(detail)) {
    return detail;
  }
  if (status === 404) {
    return "Esta información no está disponible en este momento.";
  }
  if (status === 409) {
    return "Ese horario ya no está disponible. Elija otro.";
  }
  if (status === 422) {
    return "La consulta no es válida. Avise al equipo técnico.";
  }
  if (status >= 500) {
    return "El sistema no pudo responder. Intente de nuevo en unos minutos.";
  }
  return "No se pudo obtener la información. Intente de nuevo en unos minutos.";
}

/**
 * Whether a message from the API is Spanish prose fit to show a user.
 *
 * FastAPI's own 404s and validation errors are English ("Not Found"), and the
 * generic 500 handler answers with an English sentence too. Those must not
 * reach a clinic's screen, so a detail has to look Spanish before it is shown.
 */
function looksSpanish(text: string): boolean {
  return /[áéíóúñ¿¡]/i.test(text) || /(el|la|los|las|ya|no|está|cita|horario|elija)/i.test(text);
}

/**
 * One GET against the API, as JSON.
 *
 * `clinicId` is separate from `params` because every scoped route requires it
 * and forgetting it is the mistake worth making impossible rather than
 * remembering. Row-level security would return nothing, which looks like an
 * empty clinic rather than a bug.
 */
export async function request<T>(
  path: string,
  {
    method = "GET",
    clinicId,
    params,
    body,
    patientPhone,
    timeoutMs = TIMEOUT_MS,
  }: {
    method?: "GET" | "POST" | "PUT";
    clinicId?: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    /**
     * The patient's own phone, when this call is made *as* that patient.
     *
     * Sent as `X-Patient-Phone`, which is how the API decides a caller may
     * change this appointment and no other. Omitted for a staff screen, which
     * is the path the dashboard uses: staff act for any patient and their own
     * authentication is M5's.
     *
     * A header rather than a body field, deliberately, matching the API: a
     * body field would sit alongside the appointment's own data and a route
     * that forgot to read it would silently accept whatever the caller sent.
     */
    patientPhone?: string;
    /** Overrides `TIMEOUT_MS` for a call that is legitimately slower. */
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (clinicId) url.searchParams.set("clinic_id", clinicId);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  // The browser's cookies have to be forwarded explicitly: as far as the API
  // is concerned this process is the client, so nothing travels unless it is
  // passed. Without this, an administrator's session never reaches the API and
  // every read comes back masked -- which is safe, and wrong.
  //
  // Read inside the request rather than taken as a parameter, so no call site
  // can forget it. A failure to read them is not a reason to fail the request:
  // no cookie means `staff`, which every screen renders correctly.
  // Imported here rather than at the top of the file: `next/headers` only
  // resolves inside the Next runtime, and a top-level import makes this module
  // unloadable by the plain Node test runner that covers the error paths.
  let cookie: string | undefined;
  try {
    const { headers } = await import("next/headers");
    cookie = (await headers()).get("cookie") ?? undefined;
  } catch {
    // Outside a request, or no cookies: `staff`, which every screen renders
    // correctly. Never a reason to fail the call.
    cookie = undefined;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      // The data changes as imports run and as staff book, so a cached
      // response would show a receptionist a stale clinic.
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie === undefined ? {} : { Cookie: cookie }),
        ...(patientPhone === undefined ? {} : { "X-Patient-Phone": patientPhone }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new ApiError(
      0,
      path,
      timedOut
        ? `${method} ${url} timed out after ${timeoutMs}ms.`
        : `${method} ${url} is unreachable. Is the backend running on ${API_BASE}?`,
      timedOut
        ? "El sistema tardó demasiado en responder. Intente de nuevo."
        : "No hay conexión con el sistema. Intente de nuevo en unos minutos.",
    );
  }

  if (!response.ok) {
    // The API answers errors as {detail, request_id}; fall back to the status
    // when it answered with something else entirely (a proxy, a crash).
    let detail = response.statusText;
    let requestId: string | undefined;
    try {
      const body = (await response.json()) as { detail?: string; request_id?: string };
      detail = body.detail ?? detail;
      requestId = body.request_id;
    } catch {
      /* not JSON; the status is all we have */
    }
    throw new ApiError(
      response.status,
      path,
      `${method} ${url} answered ${response.status}: ${detail}`,
      spanishFor(response.status, detail),
      requestId,
    );
  }

  return (await response.json()) as T;
}

/** A read. Every existing call site uses this. */
export const get = <T>(
  path: string,
  options: {
    clinicId?: string;
    params?: Record<string, string | number | undefined>;
    timeoutMs?: number;
  } = {},
): Promise<T> => request<T>(path, options);

/**
 * A write.
 *
 * Writes go through the same function as reads, so one place handles the
 * timeout, the Spanish error wording and the request id. The status codes the
 * scheduling routes use are meaningful and `ApiError.status` carries them: 409
 * is "another patient took that time", not a server fault, and a caller is
 * expected to tell the user so rather than retry.
 */
export const post = <T>(
  path: string,
  options: {
    clinicId?: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    patientPhone?: string;
  } = {},
): Promise<T> => request<T>(path, { ...options, method: "POST" });

// ---------------------------------------------------------------- the shapes
// Mirrors of the API's response models. Written from the live responses rather
// than from the Python source, so a field that is masked there is masked here.

export interface Clinic {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  created_at: string;
}

/** Counts behind the overview. `app_env` and the flag drive the mode banner. */
export interface Summary {
  clinic_id: string;
  app_env: string;
  real_patient_data_allowed: boolean;
  row_counts: Record<string, number>;
  appointments_by_status: Record<string, number>;
}

/** A page of results. Every list route answers in this envelope. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * A patient as the API returns them.
 *
 * The identifiers arrive masked and there is no route that unmasks them: names
 * and documents are encrypted at rest, so this is what exists to show.
 */
export interface Patient {
  id: string;
  clinic_id: string;
  document_type: string;
  document_number_masked: string;
  given_names: string;
  family_names: string;
  birth_date: string | null;
  age: number | null;
  is_minor: boolean;
  phone_masked: string | null;
  email_masked: string | null;
  created_at: string;
  /**
   * False when the three `_masked` fields above carry real values.
   *
   * The API keeps the field names for compatibility and says which it sent
   * with this flag, so a screen never has to guess from whether a value
   * contains an asterisk. Masked is the default, so an older API that omits
   * the flag is treated as masked rather than as unmasked.
   */
  identifiers_masked?: boolean;
}

export interface Doctor {
  id: string;
  clinic_id: string;
  full_name: string;
  specialty: string;
  active: boolean;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  status: string;
  /** ISO 8601 with the clinic's offset, e.g. 2026-10-06T08:00:00-05:00. */
  start: string;
  end: string;
  duration_minutes: number;
  /** Set only while the row is a hold; null on a real booking. */
  expires_at: string | null;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  patient_id: string;
  /** Already combined by the API. Names are decrypted there, not masked. */
  patient_name: string;
  location_id: string;
  location_name: string;
  appointment_type: string;
}

// ------------------------------------------------------------------ requests

export const listClinics = () => get<Clinic[]>("/review/clinics");

export const getSummary = (clinicId: string) => get<Summary>("/review/summary", { clinicId });

export const listPatients = (clinicId: string, params?: { limit?: number; offset?: number }) =>
  get<Page<Patient>>("/review/patients", { clinicId, params });

export const listDoctors = (clinicId: string, params?: { limit?: number; offset?: number }) =>
  get<Page<Doctor>>("/review/doctors", { clinicId, params });

export const listAppointments = (
  clinicId: string,
  params?: { limit?: number; offset?: number; status?: string },
) => get<Page<Appointment>>("/review/appointments", { clinicId, params });

// ------------------------------------------------- reference data for booking

/** A clinic site. Returned as a bare array, not a page envelope. */
export interface Location {
  id: string;
  clinic_id: string;
  name: string;
  address: string | null;
}

/**
 * A kind of appointment, carrying how long it takes.
 *
 * `duration_minutes` is what the booking form sends rather than an end time:
 * the length of a consultation is the clinic's decision, not the receptionist's.
 */
export interface AppointmentType {
  id: string;
  clinic_id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  sensitivity: string;
}

export const listLocations = (clinicId: string) =>
  get<Location[]>("/review/locations", { clinicId });

export const listAppointmentTypes = (clinicId: string) =>
  get<AppointmentType[]>("/review/appointment-types", { clinicId });

// -------------------------------------------------------------- escalations

/**
 * One thing a human has to deal with.
 *
 * `detail_es` is the sentence written for a receptionist and is what the screen
 * shows; `reason` is the code the queue is filtered by. `patient_name` is null
 * when nobody knows who it is about, which is itself a reason to escalate.
 */
export interface Escalation {
  id: string;
  clinic_id: string;
  reason: string;
  status: "open" | "resolved";
  detail_es: string;
  context: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  patient_id: string | null;
  patient_name: string | null;
  appointment_id: string | null;
}

export const listEscalations = (
  clinicId: string,
  params?: { status?: "open" | "resolved"; limit?: number; offset?: number },
) => get<Page<Escalation>>("/review/escalations", { clinicId, params });

export const resolveEscalation = (clinicId: string, escalationId: string) =>
  post<Escalation>(`/review/escalations/${escalationId}/resolve`, { clinicId });

// ----------------------------------------------------------------- the writes

/**
 * What a booking needs.
 *
 * `start` must carry a UTC offset — the API refuses a naive time, because a
 * time without one leaves the zone to be guessed. `duration_minutes` comes from
 * the appointment type, so the caller does not compute an end.
 *
 * `idempotency_key` is the caller's own name for this intent. Sending it again
 * returns the appointment the first call created rather than booking twice,
 * which is what makes a double-submitted form safe.
 */
export interface BookRequest {
  patient_id: string;
  doctor_id: string;
  location_id: string;
  appointment_type_id: string;
  start: string;
  duration_minutes: number;
  idempotency_key?: string;
}

export const bookAppointment = (clinicId: string, body: BookRequest) =>
  post<Appointment>("/review/appointments", { clinicId, body });

/** A booking held for a few minutes while the patient decides. */
export const holdSlot = (
  clinicId: string,
  body: BookRequest & { minutes?: number },
) => post<Appointment>("/review/appointments/holds", { clinicId, body });

export const confirmHold = (
  clinicId: string,
  appointmentId: string,
  patientPhone?: string,
) =>
  post<Appointment>(`/review/appointments/${appointmentId}/confirm`, {
    clinicId,
    patientPhone,
  });

/**
 * Cancel an appointment.
 *
 * `patientPhone` makes this a *patient* cancelling their own appointment: the
 * API resolves the number against the clinic's phone bindings and refuses the
 * call for anybody else's row. Omit it for the staff dashboard, which may
 * cancel any appointment in the clinic.
 *
 * Omitting it is not "no authorisation" so much as "the staff path", whose own
 * authentication is M5. Stated here because the difference is invisible at the
 * call site otherwise.
 */
export const cancelAppointment = (
  clinicId: string,
  appointmentId: string,
  reason?: string,
  patientPhone?: string,
) =>
  post<Appointment>(`/review/appointments/${appointmentId}/cancel`, {
    clinicId,
    body: { reason: reason ?? null },
    patientPhone,
  });

/**
 * Move an appointment. Answers with the **new** appointment, not the old one.
 *
 * The engine cancels the original and writes a replacement linked back to it,
 * so the id changes. If the new time turns out to be taken, the original is
 * left exactly as it was.
 */
export const rescheduleAppointment = (
  clinicId: string,
  appointmentId: string,
  body: { start: string; duration_minutes: number; idempotency_key?: string },
  patientPhone?: string,
) =>
  post<Appointment>(`/review/appointments/${appointmentId}/reschedule`, {
    clinicId,
    body,
    patientPhone,
  });


// -------------------------------------------------------------- the session

/** What role a browser has on the review surface. */
export type Role = "staff" | "admin";

export interface SessionInfo {
  role: Role;
  expires_in_seconds: number;
}

/**
 * Ask the API what role this browser's cookie proves.
 *
 * The cookie has to be forwarded explicitly: this process is the client as far
 * as the API is concerned, so nothing travels unless it is passed. Sent as a
 * raw `Cookie` header rather than by name, so a renamed cookie is the API's
 * business rather than something this file has to learn.
 */
export async function readSession(cookieHeader: string | undefined): Promise<SessionInfo> {
  if (!cookieHeader) return { role: "staff", expires_in_seconds: 0 };
  try {
    const response = await fetch(new URL("/review/session", API_BASE), {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", Cookie: cookieHeader },
    });
    if (!response.ok) return { role: "staff", expires_in_seconds: 0 };
    return (await response.json()) as SessionInfo;
  } catch {
    // An unreachable API is not a reason to claim a role. Masked is the floor,
    // and every screen renders correctly under it.
    return { role: "staff", expires_in_seconds: 0 };
  }
}

/**
 * Sign in. Returns the API's `Set-Cookie` so the action can pass it on.
 *
 * The raw header is returned rather than parsed: the API decides the cookie's
 * name, lifetime and flags, and re-deriving them here would mean two places
 * disagreeing about a security boundary the first time one changes.
 */
export async function signInUpstream(
  password: string,
): Promise<{ ok: boolean; status: number; setCookie: string | null }> {
  const response = await fetch(new URL("/review/session", API_BASE), {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  return {
    ok: response.ok,
    status: response.status,
    setCookie: response.headers.get("set-cookie"),
  };
}

/**
 * Sign out upstream.
 *
 * The session token is a signed HMAC rather than a stored record, so deleting
 * this process's cookie is already enough to end the session — nothing on the
 * API side outlives it. This call is still made, because the API owns the
 * cookie it set and `DELETE /review/session` is how it clears it; leaving that
 * to a second implementation here is how the two drift apart.
 *
 * Failure is deliberately ignored. Signing out must never leave somebody
 * signed in because the API was unreachable, and the caller deletes the local
 * cookie either way.
 */
export async function signOutUpstream(cookieHeader: string | undefined): Promise<void> {
  if (!cookieHeader) return;
  try {
    await fetch(new URL("/review/session", API_BASE), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", Cookie: cookieHeader },
    });
  } catch {
    // Unreachable API: the local cookie still goes.
  }
}
