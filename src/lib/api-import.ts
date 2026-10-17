import "server-only";

/**
 * The remaining API surfaces: the M1 importer, the M0 audit log, and patient
 * detail.
 *
 * Separate from `api.ts` to keep that file about the scheduling surfaces a
 * receptionist uses all day. Everything here is either an import run, which is
 * a sequence rather than a read, or an administrator's screen.
 *
 * The same rules apply: server-side only, cookies forwarded so a session
 * reaches the API, and the API's own Spanish preferred wherever it sends some —
 * the importer's refusals name the row and the column, and nothing generic
 * written here would be as useful to the person reading them.
 */

import {
  ApiError,
  API_BASE,
  get,
  post,
  request,
  spanishFor,
  type Appointment,
  type Doctor,
  type Page,
  type Patient,
} from "@/lib/api";

// ========================================================== M1: the importer

/** One column of a sheet, and what the matcher made of it. */
export interface ImportColumn {
  column: string;
  /** Null when nothing matched, which is a question rather than a failure. */
  target_field: string | null;
  /** `exact`, `strong`, `weak`, `model`, `confirmed` — how it was decided. */
  confidence: string;
  reason: string;
  /** True when the match was applied without asking. */
  auto: boolean;
  total?: number;
  valid?: number;
  review?: number;
  invalid?: number;
  /** Over the whole column, not a sample: M1 converts every row. */
  percent_valid?: number;
}

export interface ImportSheet {
  sheet: string;
  entity: string;
  entity_reason: string;
  columns: ImportColumn[];
  missing_required: string[];
  /** What the file cannot settle: a date column that reads either way, say. */
  questions: string[];
  warnings: string[];
  total_rows: number;
  valid_rows: number;
  review_rows: number;
  invalid_rows: number;
}

/**
 * A question about how to read the file itself.
 *
 * Which row holds the headings; whether an overlong row is cut or dropped.
 * Declining is always the reading the importer would have used unasked, so a
 * reviewer can decline safely.
 */
export interface StructureQuestion {
  id: string;
  sheet: string;
  finding: string;
  if_approved: string;
  if_declined: string;
  answered?: boolean | null;
}

export interface ImportSession {
  session_id: string;
  filename: string;
  file_sha256: string;
  encoding?: string | null;
  delimiter?: string | null;
  sheets: ImportSheet[];
  structure_questions?: StructureQuestion[];
  status: string;
  /** Sheets whose mapping came from a stored profile rather than matching. */
  reused_profiles?: string[];
  duplicate_of?: string | null;
}

export interface ImportValidation {
  session_id: string;
  status: string;
  sheets: ImportSheet[];
  can_commit: boolean;
  /** Exactly what `commit` will refuse on. This is M1's exit criterion. */
  blocking: string[];
  tolerated?: string[];
}

export interface ImportCommit {
  session_id: string;
  status: string;
  committed: Record<string, number>;
  created?: Record<string, number>;
  updated?: Record<string, number>;
  skipped: Record<string, number>;
  conflicts?: string[];
  message: string;
}

/** One staged row, with the reason it needs a person if it does. */
export interface ImportRow {
  row_number: number;
  status: string;
  values: Record<string, string | null>;
  errors: string[];
  reviews: string[];
}

/** A stored per-clinic mapping, reused when a file of the same shape arrives. */
export interface MappingProfile {
  id: string;
  name: string;
  header_fingerprint: string;
  entity: string;
  mapping: Record<string, string | null>;
  version: number;
}

/**
 * A canonical field, for the mapping screen's pickers.
 *
 * `entity` is added by `listCanonicalFields`: the API returns the fields
 * grouped by entity rather than flat, and a picker needs to filter by it.
 */
export interface CanonicalField {
  name: string;
  entity: string;
  description: string;
  /** `required`, `optional`, or `recommended` -- the API's own word. */
  requirement: string;
  examples?: string[];
  aliases?: string[];
}

/** The API's own shape: fields grouped under the entity they belong to. */
type CanonicalFieldGroups = Record<
  string,
  { name: string; requirement: string; description: string; examples?: string[]; aliases?: string[] }[]
>;

export const getImportSession = (clinicId: string, sessionId: string) =>
  get<ImportSession>(`/onboarding/uploads/${sessionId}`, { clinicId });

export const setImportMapping = (
  clinicId: string,
  sessionId: string,
  body: {
    sheet: string;
    mapping: Record<string, string | null>;
    entity?: string | null;
    decisions?: Record<string, string>;
    excluded_rows?: number[];
  },
) =>
  request<ImportSession>(`/onboarding/uploads/${sessionId}/mapping`, {
    method: "PUT",
    clinicId,
    body,
  });

export const answerStructureQuestion = (
  clinicId: string,
  sessionId: string,
  body: { id: string; approved: boolean },
) => post<ImportSession>(`/onboarding/uploads/${sessionId}/structure`, { clinicId, body });

export const validateImport = (clinicId: string, sessionId: string) =>
  post<ImportValidation>(`/onboarding/uploads/${sessionId}/validate`, { clinicId });

export const commitImport = (clinicId: string, sessionId: string) =>
  post<ImportCommit>(`/onboarding/uploads/${sessionId}/commit`, { clinicId });

/**
 * The staged rows, filtered by state.
 *
 * Answers a bare array rather than the `{items, total}` envelope every
 * `/review` list uses. Typed as the array it actually is: assuming the
 * envelope made the page read `.items` of undefined and 500.
 */
export const listImportRows = (
  clinicId: string,
  sessionId: string,
  params?: { sheet?: string; status?: string; limit?: number; offset?: number },
) => get<ImportRow[]>(`/onboarding/uploads/${sessionId}/rows`, { clinicId, params });

export const listMappingProfiles = (clinicId: string) =>
  get<MappingProfile[]>("/onboarding/profiles", { clinicId });

/**
 * Every canonical field, flattened and tagged with its entity.
 *
 * The API groups them, which is the right shape for its own docs but not for a
 * picker that has to offer the fields of one sheet's entity. Flattened here
 * rather than in the page, so one call site owns the knowledge of the API's
 * shape.
 */
export async function listCanonicalFields(): Promise<CanonicalField[]> {
  const groups = await get<CanonicalFieldGroups>("/onboarding/canonical-fields");
  return Object.entries(groups).flatMap(([entity, fields]) =>
    fields.map((field) => ({ ...field, entity })),
  );
}

/**
 * Upload a spreadsheet.
 *
 * Takes the bytes rather than a browser `File`: the file reaches a Server
 * Action first, because the API sends no CORS headers and requires a loopback
 * Host, so a page cannot post to it directly. A clinic's spreadsheet holds
 * cédulas, so it travels the same path as every other piece of patient data.
 */
export async function uploadSpreadsheet(
  clinicId: string,
  filename: string,
  bytes: ArrayBuffer,
): Promise<ImportSession> {
  const url = new URL("/onboarding/uploads", API_BASE);
  url.searchParams.set("clinic_id", clinicId);

  const body = new FormData();
  body.set("file", new Blob([bytes]), filename);

  let cookie: string | undefined;
  try {
    const { headers } = await import("next/headers");
    cookie = (await headers()).get("cookie") ?? undefined;
  } catch {
    cookie = undefined;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      // Longer than a normal call: a spreadsheet is parsed in its own process
      // on the way in, and a large export legitimately takes a while.
      signal: AbortSignal.timeout(120_000),
      headers: {
        Accept: "application/json",
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      body,
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new ApiError(
      0,
      "/onboarding/uploads",
      `POST ${url} ${timedOut ? "timed out" : "is unreachable"}.`,
      timedOut
        ? "El archivo tardó demasiado en procesarse. Intente con un archivo más pequeño."
        : "No hay conexión con el sistema. Intente de nuevo en unos minutos.",
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    let requestId: string | undefined;
    try {
      const payload = (await response.json()) as {
        detail?: string;
        request_id?: string;
      };
      detail = payload.detail ?? detail;
      requestId = payload.request_id;
    } catch {
      /* not JSON; the status is all we have */
    }
    throw new ApiError(
      response.status,
      "/onboarding/uploads",
      `POST ${url} answered ${response.status}: ${detail}`,
      // The importer's own refusals are Spanish and specific — "el archivo
      // declara 1.073.741.939 bytes sin comprimir" names the problem far
      // better than anything generic, and a reviewer has to act on it.
      spanishFor(response.status, detail),
      requestId,
    );
  }

  return (await response.json()) as ImportSession;
}

// ============================================== M0: the audit log, admin only

export interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_kind: string;
  actor_id: string | null;
  patient_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  purpose: string;
  channel: string | null;
  request_id: string | null;
  processor: string | null;
  processor_model: string | null;
  fields_disclosed: string[] | null;
  zero_retention: boolean | null;
  /** The chain link: enough to match a row to a verification, not the hash. */
  row_hash_prefix: string;
}

/** What `/audit-log/verify` reports about the hash chain. */
export interface ChainVerification {
  rows_checked: number;
  intact: boolean;
  first_broken_id: number | null;
  truncated_after_id: number | null;
}

export const listAuditLog = (params?: {
  action?: string;
  resource?: string;
  patient_id?: string;
  limit?: number;
  offset?: number;
}) => get<Page<AuditEntry>>("/review/audit-log", { params });

/**
 * Walk the whole chain and report whether it is intact.
 *
 * Deliberately given a longer timeout than every other read. The check is O(n)
 * over the entire log by design -- that is what makes it a verification rather
 * than a sample -- so it takes about ten seconds at 56,000 entries and grows
 * with the log. The default 10s timeout put it right on the edge, which showed
 * up as a test that passed one run and failed the next.
 *
 * The page renders without it rather than waiting: see `/audit`.
 */
export const verifyAuditChain = () =>
  get<ChainVerification>("/review/audit-log/verify", { timeoutMs: 60_000 });

// ================================================ M1: patient detail surfaces

export interface Consent {
  id: string;
  patient_id: string;
  purpose: string;
  channel: string;
  evidence_kind: string;
  active: boolean;
  granted_at: string | null;
  verified_at: string | null;
  revoked_at: string | null;
}

export interface PhoneBinding {
  id: string;
  patient_id: string;
  relationship_kind: string;
  phone_masked: string | null;
  verified_at: string | null;
  revoked_at: string | null;
}

/** A patient with everything attached to them. */
export interface PatientDetail extends Patient {
  consents: Consent[];
  phone_bindings: PhoneBinding[];
  appointments: Appointment[];
}

export const getPatient = (clinicId: string, patientId: string) =>
  get<PatientDetail>(`/review/patients/${patientId}`, { clinicId });



/**
 * One converted cell, and the named rule that produced it.
 *
 * This is M1's audit evidence: every cell the importer touched, with the value
 * the clinic's file held beside the value it became and the rule that decided.
 * `raw` is never overwritten by a reviewer's answer — the answer is stored
 * beside it — so the log keeps working as a record of what actually arrived.
 */
export interface TransformCell {
  row_number: number;
  column: string;
  target_field: string | null;
  /** The clinic's own value, verbatim. */
  raw: string;
  /** Set when a reviewer answered rather than the file deciding. */
  corrected_from_review?: string | null;
  normalized: string | null;
  /** The rule's name, e.g. `phone.not_assigned`. */
  rule: string;
  status: string;
  /** The refusal, naming the row and the column. */
  message?: string;
  /** What the field means, for the guidance below. */
  means?: string;
  /** What the reviewer should do about it. */
  action?: string;
}

export const listTransformLog = (
  clinicId: string,
  sessionId: string,
  params?: { status?: string; limit?: number },
) =>
  get<TransformCell[]>(`/onboarding/uploads/${sessionId}/transform-log`, {
    clinicId,
    params,
  });

/** A reviewer's answer for one cell. `raw` is kept; this is stored beside it. */
export const correctRow = (
  clinicId: string,
  sessionId: string,
  body: { sheet: string; row_number: number; cells: Record<string, string> },
) => post<ImportSession>(`/onboarding/uploads/${sessionId}/rows/correct`, { clinicId, body });

// ============================== M2: availability, made visible

/** One bookable slot, computed from rules rather than read from a table. */
export interface Slot {
  start: string;
  end: string;
  duration_minutes: number;
}

/**
 * What a doctor can genuinely offer in a date range.
 *
 * Recomputed per request from their weekly rules, dated exceptions, Colombian
 * public holidays and their existing diary. An empty array is an ordinary
 * answer: it is what the conversation graph escalates on, and what a
 * receptionist sees when a week is full.
 */
export const findSlots = (
  clinicId: string,
  params: {
    doctor_id: string;
    appointment_type_id: string;
    start_date: string;
    end_date: string;
    earliest?: string;
    latest?: string;
    limit?: number;
  },
) => get<Slot[]>("/review/availability/slots", { clinicId, params });

/** A doctor's weekly rule: this weekday, these hours, at this site. */
export interface AvailabilityRule {
  id: string;
  location_id: string;
  weekday: number;
  weekday_name: string;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string | null;
}

/** A dated departure from the weekly rules: a morning off, or extra hours. */
export interface AvailabilityException {
  id: string;
  on_date: string;
  kind: string;
  start_time: string | null;
  end_time: string | null;
}

/** A doctor with the schedule behind them. */
export interface DoctorDetail extends Doctor {
  availability_rules: AvailabilityRule[];
  availability_exceptions: AvailabilityException[];
  upcoming_active_appointments: number;
}

export const getDoctor = (clinicId: string, doctorId: string) =>
  get<DoctorDetail>(`/review/doctors/${doctorId}`, { clinicId });

// =============================== M1: phones shared between patients

/**
 * One phone number with more than one patient on it.
 *
 * A household handset, or a carer's. It matters because a reminder sent there
 * discloses an appointment to whoever answers, so M4's dispatch gate has to
 * consult it -- and staff should know before then.
 *
 * `reference` is a short opaque handle rather than the number: the number
 * itself is encrypted at rest and never returned by this route.
 */
export interface SharedHandset {
  reference: string;
  patient_count: number;
  members: { patient_id: string; patient_name: string; relationship_kind: string }[];
}

export const listSharedHandsets = (clinicId: string) =>
  get<SharedHandset[]>("/review/phone-bindings/shared", { clinicId });

// =============================== M3: the conversation pipeline

/** One reason the gate refused a draft, with the text that caused it. */
export interface GateFinding {
  reason: string;
  span: string;
  detail: string;
}

/**
 * One draft attempt and the gate's verdict on it.
 *
 * Every attempt is returned, not only the last. ADR-23 bounds retries at two,
 * and the only way to see that bound holding is to count the drafts.
 */
export interface ConversationDraft {
  text: string;
  kind: string;
  approved: boolean;
  templated: boolean;
  findings: GateFinding[];
}

/**
 * What one turn through the graph produced.
 *
 * `outbound_text` is what the patient would receive. `stop` names which of the
 * eight early exits the turn took, or is null when it ran to dispatch. The
 * drafts and `verified_facts` are what make the screen a review surface rather
 * than a chat window: they show that the reply states only facts a tool
 * established, and that nothing the gate refused was sent.
 */
export interface ConversationTurn {
  intent: string;
  stop: string | null;
  outbound_text: string | null;
  drafts: ConversationDraft[];
  attempts: number;
  reason_codes: string[];
  patient_resolved: boolean;
  escalation_id: string | null;
  verified_facts: Record<string, string>;
}

/**
 * Run one turn as a patient would send it.
 *
 * Takes a phone number rather than a patient id on purpose: the graph resolves
 * the patient from the number's blind index exactly as a real channel will, so
 * naming a patient directly would skip the step worth demonstrating.
 */
export const runConversationTurn = (
  clinicId: string,
  body: { sender_phone: string; text: string },
) => post<ConversationTurn>("/review/conversation/turn", { clinicId, body });
