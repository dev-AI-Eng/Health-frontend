/**
 * Signing in, for the tests that need an administrator.
 *
 * The password comes from the environment rather than from this file. It is
 * only ever a local development value, but CLAUDE.md rule 6 names a test
 * fixture as one of the places a secret must never be written, and a literal
 * here would also be the first thing a secret scan flags in CI.
 *
 * Set it the same way the API does, from the backend's own `.env`:
 *
 *   REVIEW_ADMIN_PASSWORD=... npx playwright test
 *
 * Unset, the admin tests skip rather than fail: a missing local credential is
 * not a broken dashboard, and a false red here teaches people to ignore reds.
 */

import { expect, test, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = process.env.REVIEW_ADMIN_PASSWORD ?? "";

/** Skip the calling test when no administrator password is configured. */
export function requireAdminPassword(): void {
  test.skip(
    ADMIN_PASSWORD === "",
    "REVIEW_ADMIN_PASSWORD is not set; see e2e/auth.ts",
  );
}

/**
 * Sign in as an administrator and wait for the confirmation.
 *
 * Waits on the toast rather than on navigation, because the Server Action
 * revalidates in place: the URL never changes, so a `waitForURL` would pass
 * before the session cookie had been set.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Sesión de administrador iniciada.")).toBeVisible({
    timeout: 20000,
  });
}
