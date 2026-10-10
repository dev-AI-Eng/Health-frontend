import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

/**
 * Which language this request renders in.
 *
 * Read from a cookie on the server, so the first paint is already correct: a
 * client-side switch would render Spanish and then flip, which looks like a
 * bug. Every page is `force-dynamic` already, so reading a cookie costs nothing
 * it was not already paying.
 */
export async function currentLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
