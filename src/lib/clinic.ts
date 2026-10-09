/**
 * Which clinic the dashboard is looking at.
 *
 * Every scoped route needs a `clinic_id`, and nothing yet says who is logged
 * in: authentication and roles arrive with the dashboard milestone. Until
 * then the clinic comes from `CLINIC_ID` if it is set, and otherwise from the
 * first clinic the API lists -- which is the only one a synthetic-data
 * install has.
 *
 * This is the one piece that must change when auth lands, so it is one
 * function rather than a `listClinics()[0]` scattered through the pages.
 */
import "server-only";

import { type Clinic, listClinics } from "./api.ts";

/**
 * No clinic to show. An install problem, not something a user did.
 *
 * Carries `spanish` for the same reason `ApiError` does: the English sentence
 * names a command to run, which belongs in the log, not on a clinic's screen.
 */
export class NoClinicError extends Error {
  readonly spanish =
    "Todavía no hay ninguna clínica configurada. Avise al equipo técnico.";

  constructor() {
    super(
      "The API has no clinics. Run `python main.py` against a seeded database, " +
        "or set CLINIC_ID to the clinic you want.",
    );
    this.name = "NoClinicError";
  }
}

/** A `CLINIC_ID` that the API does not serve. Misconfiguration, same as above. */
export class UnknownClinicError extends Error {
  readonly spanish =
    "La clínica configurada no existe. Avise al equipo técnico.";

  constructor(id: string) {
    super(`CLINIC_ID ${id} is not a clinic this API serves.`);
    this.name = "UnknownClinicError";
  }
}

/** The clinic every page works against, with its name for the header. */
export async function currentClinic(): Promise<Clinic> {
  const clinics = await listClinics();
  if (clinics.length === 0) throw new NoClinicError();

  const pinned = process.env.CLINIC_ID;
  if (!pinned) return clinics[0];

  const found = clinics.find((clinic) => clinic.id === pinned);
  if (!found) throw new UnknownClinicError(pinned);
  return found;
}
