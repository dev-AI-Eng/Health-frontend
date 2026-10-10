/**
 * Names shared with the API.
 *
 * Kept in one place so a rename is one edit, and importable from both server
 * and client code — unlike the modules marked `server-only`.
 */

/** Must match `SESSION_COOKIE` in the API's `review/auth.py`. */
export const SESSION_COOKIE_NAME = "clinic_session";

/** Must match `THEME_COOKIE` in `lib/theme.ts`. */
export const THEME_COOKIE_NAME = "dashboard_theme";
