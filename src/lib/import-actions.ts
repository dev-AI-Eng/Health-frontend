"use server";

/**
 * Driving an import: upload, correct, answer, validate, commit.
 *
 * The file is posted to a Server Action rather than to the API, for the same
 * reason every other write goes this way — and with more at stake: a clinic's
 * spreadsheet holds cédulas, names and phone numbers, so it must travel the
 * same audited path as every other piece of patient data rather than leave the
 * browser toward a different origin.
 *
 * Every action returns a result object rather than throwing. An import is a
 * conversation with a reviewer: "row 6 names a doctor this clinic does not
 * have" is the product working, and a thrown exception would arrive in the
 * browser as a digest with the message stripped.
 */

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import {
  answerStructureQuestion,
  commitImport,
  setImportMapping,
  uploadSpreadsheet,
  validateImport,
  type ImportCommit,
  type ImportSession,
  type ImportValidation,
} from "@/lib/api-import";
import { currentClinic } from "@/lib/clinic";
import { translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

export type ImportResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; requestId?: string };

/** Turn a thrown error into something a reviewer can act on. */
async function failure<T>(error: unknown, fallbackKey: "upload" | "generic"): Promise<ImportResult<T>> {
  const t = translator(await currentLocale());
  if (error instanceof ApiError) {
    console.error(`[import] ${error.message}`);
    return { ok: false, message: error.spanish, requestId: error.requestId };
  }
  console.error(`[import] ${error instanceof Error ? error.message : String(error)}`);
  return {
    ok: false,
    message: fallbackKey === "upload" ? t("import.uploadFailed") : t("error.title"),
  };
}

/**
 * Accept a spreadsheet and read it.
 *
 * Nothing is written: this parses the file, proposes a mapping and reports what
 * it found. The commit is a separate, deliberate step, which is the whole point
 * of M1 — a clinic's records are not changed by dropping a file on a page.
 */
export async function upload(form: FormData): Promise<ImportResult<ImportSession>> {
  try {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      const t = translator(await currentLocale());
      return { ok: false, message: t("import.noFile") };
    }

    const clinic = await currentClinic();
    const session = await uploadSpreadsheet(
      clinic.id,
      file.name,
      await file.arrayBuffer(),
    );
    revalidatePath("/import");
    return { ok: true, data: session };
  } catch (error) {
    return failure<ImportSession>(error, "upload");
  }
}

/**
 * Correct a sheet's mapping, answer its column questions, exclude rows.
 *
 * All three travel together because the API takes them together: a mapping is
 * a statement about the whole sheet, and sending the pieces separately would
 * let a half-corrected sheet validate.
 */
export async function correctMapping(form: FormData): Promise<ImportResult<ImportSession>> {
  try {
    const clinic = await currentClinic();
    const sessionId = String(form.get("session_id") ?? "");
    const sheet = String(form.get("sheet") ?? "");
    if (!sessionId || !sheet) {
      return { ok: false, message: (await translator(await currentLocale()))("error.title") };
    }

    // `mapping` and `decisions` arrive as JSON because they are objects keyed
    // by the clinic's own column headings, which may contain anything.
    const mapping = JSON.parse(String(form.get("mapping") ?? "{}")) as Record<
      string,
      string | null
    >;
    const decisions = JSON.parse(String(form.get("decisions") ?? "{}")) as Record<
      string,
      string
    >;
    const entity = form.get("entity");

    const session = await setImportMapping(clinic.id, sessionId, {
      sheet,
      mapping,
      entity: typeof entity === "string" && entity !== "" ? entity : undefined,
      decisions,
    });
    revalidatePath(`/import/${sessionId}`);
    const t = translator(await currentLocale());
    return { ok: true, data: session, message: t("import.mappingSaved") };
  } catch (error) {
    return failure<ImportSession>(error, "generic");
  }
}

/**
 * Answer a question about how to read the file.
 *
 * Declining is always the reading the importer would have used unasked, so a
 * reviewer who is unsure can decline without losing anything.
 */
export async function answerStructure(form: FormData): Promise<ImportResult<ImportSession>> {
  try {
    const clinic = await currentClinic();
    const sessionId = String(form.get("session_id") ?? "");
    const id = String(form.get("question_id") ?? "");
    const approved = form.get("approved") === "true";

    const session = await answerStructureQuestion(clinic.id, sessionId, { id, approved });
    revalidatePath(`/import/${sessionId}`);
    const t = translator(await currentLocale());
    return {
      ok: true,
      data: session,
      message: approved ? t("import.questionApproved") : t("import.questionDeclined"),
    };
  } catch (error) {
    return failure<ImportSession>(error, "generic");
  }
}

/** Convert every row and report what blocks the commit. */
export async function validate(form: FormData): Promise<ImportResult<ImportValidation>> {
  try {
    const clinic = await currentClinic();
    const sessionId = String(form.get("session_id") ?? "");
    const validation = await validateImport(clinic.id, sessionId);
    revalidatePath(`/import/${sessionId}`);

    const t = translator(await currentLocale());
    return {
      ok: true,
      data: validation,
      message: validation.can_commit ? t("import.readyToCommit") : t("import.blocked"),
    };
  } catch (error) {
    return failure<ImportValidation>(error, "generic");
  }
}

/**
 * Write the staged rows.
 *
 * Refuses on exactly what `validate` reported — the milestone's exit criterion,
 * and a 409 here is the product working rather than a fault. The message says
 * what blocked it.
 */
export async function commit(form: FormData): Promise<ImportResult<ImportCommit>> {
  try {
    const clinic = await currentClinic();
    const sessionId = String(form.get("session_id") ?? "");
    const committed = await commitImport(clinic.id, sessionId);

    revalidatePath(`/import/${sessionId}`);
    revalidatePath("/patients");
    revalidatePath("/appointments");
    revalidatePath("/");
    return { ok: true, data: committed, message: committed.message };
  } catch (error) {
    return failure<ImportCommit>(error, "generic");
  }
}
