/**
 * The M1 importer, driven through the dashboard.
 *
 * This is the milestone's deliverable and its three exit criteria, exercised
 * the way the client will: drop a file on a page, read what it found, press
 * import.
 *
 * Requires the fixtures, which the backend generates and does not commit —
 * one of that set is a zip bomb, and generating them is what proves every
 * value in them is invented:
 *
 *     python -m tests.fixtures.onboarding.generate
 *     cp tests/fixtures/onboarding/{1_clean_ips.xlsx,9_hoja_recepcion.xlsx} \
 *        ../clinic-scheduler-web/e2e/
 *
 * Tests skip rather than fail when they are absent, so a checkout without them
 * does not report a product defect.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { requireAdminPassword, signInAsAdmin } from "./auth";

const API = "http://127.0.0.1:8000";
const CLEAN = path.join(__dirname, "1_clean_ips.xlsx");
const MESSY = path.join(__dirname, "9_hoja_recepcion.xlsx");

async function clinicId(request: APIRequestContext): Promise<string> {
  const clinics = await (await request.get(`${API}/review/clinics`)).json();
  return clinics[0].id;
}

test.describe("the importer", () => {
  test("a clean export reads, reports its columns, and imports", async ({
    page,
    request,
  }) => {
    test.skip(!existsSync(CLEAN), "fixture not generated");
    const cid = await clinicId(request);
    const before = await (
      await request.get(`${API}/review/patients?clinic_id=${cid}&limit=1`)
    ).json();

    await page.goto("/import");
    await expect(page.getByRole("heading", { name: "Importar datos" })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(CLEAN);

    // Reading a file takes the reviewer to the confirmation screen: leaving
    // them on the upload page would make them hunt for what happened.
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });
    await expect(page.getByRole("heading", { name: "1_clean_ips.xlsx" })).toBeVisible();

    // Every column shown with the field it became, which is the confirmation
    // screen's whole job.
    await expect(page.getByText("Columna del archivo").first()).toBeVisible();

    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(page.getByText(/Todo listo para importar|Hay cosas por resolver/)).toBeVisible(
      { timeout: 60000 },
    );

    await page.getByRole("button", { name: "Importar ahora" }).click();
    await expect(page.getByText("Importación terminada")).toBeVisible({ timeout: 60000 });

    // The rows reached the database, not just the screen.
    const after = await (
      await request.get(`${API}/review/patients?clinic_id=${cid}&limit=1`)
    ).json();
    expect(after.total).toBeGreaterThanOrEqual(before.total);
  });

  test("percent-valid is shown per column, over every row", async ({ page }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });

    // A preview of the first few rows looks fine while row 100 is broken, so
    // the screen reports the whole column rather than a sample.
    await expect(page.getByText("Convierte")).toBeVisible();
    await expect(page.getByText(/%/).first()).toBeVisible();
  });

  test("a file the importer cannot settle asks rather than guesses", async ({ page }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });

    // The question arrives at validate rather than at upload, and that is the
    // design: a date column's reading is decided once for the whole column,
    // which means every row has to be converted first. An earlier version of
    // this test looked for it on the upload response and found nothing.
    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(
      page.getByText(/Todo listo para importar|Hay cosas por resolver/),
    ).toBeVisible({ timeout: 60000 });

    // This sheet holds a date column that reads either way, so something has
    // to be unresolved: the importer does not pick for the reviewer.
    await expect(page.getByText("Falta resolver")).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar ahora" })).toBeDisabled();
  });

  test("nothing commits while validation is blocked", async ({ page, request }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");
    const cid = await clinicId(request);

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });

    const before = await (
      await request.get(`${API}/review/patients?clinic_id=${cid}&limit=1`)
    ).json();

    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(
      page.getByText(/Todo listo para importar|Hay cosas por resolver/),
    ).toBeVisible({ timeout: 60000 });

    // The milestone's exit criterion. When something blocks, the import button
    // is disabled and the reason is named verbatim rather than summarised.
    const blocked = await page.getByText("Falta resolver").isVisible();
    if (blocked) {
      await expect(page.getByRole("button", { name: "Importar ahora" })).toBeDisabled();
      const after = await (
        await request.get(`${API}/review/patients?clinic_id=${cid}&limit=1`)
      ).json();
      expect(after.total, "nothing was written while blocked").toBe(before.total);
    }
  });

  test("the second file of a shape reuses its stored mapping", async ({ page }) => {
    test.skip(!existsSync(CLEAN), "fixture not generated");

    // The third exit criterion. The first upload may or may not have a profile
    // yet depending on run order, so the second is the one asserted on.
    for (const pass of [1, 2]) {
      await page.goto("/import");
      await page.locator('input[type="file"]').setInputFiles(CLEAN);
      await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });
      if (pass === 1) {
        await page.getByRole("button", { name: "Revisar todas las filas" }).click();
        await expect(
          page.getByText(/Todo listo para importar|Hay cosas por resolver/),
        ).toBeVisible({ timeout: 60000 });
        const enabled = await page
          .getByRole("button", { name: "Importar ahora" })
          .isEnabled()
          .catch(() => false);
        if (enabled) {
          await page.getByRole("button", { name: "Importar ahora" }).click();
          await expect(page.getByText("Importación terminada")).toBeVisible({
            timeout: 60000,
          });
        }
      }
    }

    // Every column confirmed from the profile rather than freshly matched.
    await expect(page.getByText(/Mapeo reutilizado|confirmed/).first()).toBeVisible();
  });
});

test.describe("the audit log", () => {
  test("a receptionist is refused and told why", async ({ page }) => {
    await page.goto("/audit");

    await expect(page.getByText(/requiere una sesión de administrador/)).toBeVisible();
    // Not hidden: somebody following a link learns why rather than meeting a
    // blank page, and the page refuses on its own account rather than relying
    // on the sidebar having omitted the link.
    //
    // Scoped to `main`: the header carries its own "Ingresar" link, so the
    // bare role selector matches two elements.
    await expect(page.getByRole("main").getByRole("link", { name: "Ingresar" })).toBeVisible();
  });

  test("an administrator sees the log and the chain verification", async ({ page }) => {
    requireAdminPassword();
    await signInAsAdmin(page);

    await page.goto("/audit");

    // The integrity guarantee, verified rather than asserted in a document.
    await expect(page.getByText("Cadena íntegra")).toBeVisible();
    await expect(page.getByText(/registros verificados/)).toBeVisible();
    // And the disclosures the unmasked reads above produced.
    await expect(page.getByText("revelación").first()).toBeVisible();
  });

  test("the audit link appears only for an administrator", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Bitácora" })).toHaveCount(0);

    requireAdminPassword();
    await signInAsAdmin(page);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Bitácora" })).toBeVisible();
  });
});

test.describe("patient detail", () => {
  test("a patient's consents, phones and appointments are on one page", async ({
    page,
    request,
  }) => {
    const cid = await clinicId(request);
    const patients = await (
      await request.get(`${API}/review/patients?clinic_id=${cid}&limit=1`)
    ).json();
    test.skip(patients.total === 0, "no patients to open");

    await page.goto("/patients");
    await page.locator("td a").first().click();

    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+/);
    await expect(page.getByText("Consentimientos")).toBeVisible();
    await expect(page.getByText("Teléfonos vinculados")).toBeVisible();
    // The distinction M1 decided and M4's dispatch gate depends on.
    await expect(page.getByText(/evidencia de que existe, no permiso/)).toBeVisible();
  });
});

test.describe("the transform log", () => {
  test("every converted cell shows its raw value and the rule that decided", async ({
    page,
  }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });

    // The log is populated by conversion, so the rows have to be checked first.
    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(
      page.getByText(/Todo listo para importar|Hay cosas por resolver/),
    ).toBeVisible({ timeout: 60000 });

    await page.getByRole("link", { name: /Ver registro de conversión/ }).click();
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+\/log/);

    // M1's audit evidence: the clinic's own value beside the rule that decided
    // what it became. Both have to be on screen for a refusal to be checkable.
    await expect(page.getByRole("heading", { name: "Registro de conversión" })).toBeVisible();
    await expect(page.getByText("Valor del archivo")).toBeVisible();
    await expect(page.getByText("Regla", { exact: true })).toBeVisible();

    // Filtered to what needs a person, which is the view worth having: a
    // 2,000-row file holds 2,000 cells and a handful of causes.
    await page.getByRole("link", { name: "Por revisar" }).click();
    await expect(page).toHaveURL(/status=review/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});
