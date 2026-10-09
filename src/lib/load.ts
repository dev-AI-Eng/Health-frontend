/**
 * Fetch a page's data, or get back something the page can render instead.
 *
 * Every page needs the same three things: the clinic, its own data, and a way
 * to fail that leaves a readable screen rather than a 500. This is that, once,
 * so a new page cannot forget the third one.
 *
 * The discriminated return is the point. A page handles `ok: false` because
 * TypeScript will not let it reach `.data` without checking, which is a
 * stronger guarantee than remembering to write a try/catch.
 */
import "server-only";

import { ApiError, type Clinic } from "./api.ts";
import { currentClinic } from "./clinic.ts";

export type Loaded<T> =
  | { ok: true; clinic: Clinic; data: T }
  | { ok: false; spanish: string; requestId?: string };

/**
 * The Spanish sentence an error should put on screen.
 *
 * Anything carrying its own `spanish` wrote it deliberately. Anything else is
 * a bug we did not anticipate -- a null dereference, a bad JSON shape -- and
 * its message is English and about our code, so the screen gets the generic
 * line and the log gets the real thing.
 */
export function spanishOf(error: unknown): string {
  if (
    error !== null &&
    typeof error === "object" &&
    "spanish" in error &&
    typeof error.spanish === "string"
  ) {
    return error.spanish;
  }
  return "Ocurrió un error inesperado. Intente de nuevo en unos minutos.";
}

/**
 * Resolve the clinic, then load one page's data for it.
 *
 * The English detail is logged here and nowhere else, so there is one place to
 * point at when asked where the technical message went.
 */
export async function load<T>(
  /** Named for the log line, so a failure says which screen it was. */
  screen: string,
  fetcher: (clinic: Clinic) => Promise<T>,
): Promise<Loaded<T>> {
  try {
    const clinic = await currentClinic();
    return { ok: true, clinic, data: await fetcher(clinic) };
  } catch (error) {
    console.error(
      `[${screen}] ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ok: false,
      spanish: spanishOf(error),
      requestId: error instanceof ApiError ? error.requestId : undefined,
    };
  }
}
