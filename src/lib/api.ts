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
const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

/** How long to wait before giving up on the API, in milliseconds. */
const TIMEOUT_MS = 10_000;

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
function spanishFor(status: number): string {
  if (status === 404) {
    return "Esta información no está disponible en este momento.";
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
 * One GET against the API, as JSON.
 *
 * `clinicId` is separate from `params` because every scoped route requires it
 * and forgetting it is the mistake worth making impossible rather than
 * remembering. Row-level security would return nothing, which looks like an
 * empty clinic rather than a bug.
 */
async function get<T>(
  path: string,
  { clinicId, params }: { clinicId?: string; params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (clinicId) url.searchParams.set("clinic_id", clinicId);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      // The review API is read-only and its data changes as imports run, so a
      // cached response would show a receptionist a stale clinic.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new ApiError(
      0,
      path,
      timedOut
        ? `GET ${url} timed out after ${TIMEOUT_MS}ms.`
        : `GET ${url} is unreachable. Is the backend running on ${API_BASE}?`,
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
      `GET ${url} answered ${response.status}: ${detail}`,
      spanishFor(response.status),
      requestId,
    );
  }

  return (await response.json()) as T;
}

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
