import "server-only";

import { cookies } from "next/headers";

export type Theme = "light" | "dark";

/** The cookie the toggle sets. Read on the server so the first paint is right. */
export const THEME_COOKIE = "dashboard_theme";

/**
 * Which theme this request renders in.
 *
 * Light by default rather than following the operating system: a clinic's
 * machine is often set to whatever it shipped with, and a receptionist who
 * has not chosen is better served by the brighter of the two.
 */
export async function currentTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
