/**
 * The three surfaces added after auditing API coverage: M2's availability made
 * visible, phones shared between patients, and reviewing a single import row.
 *
 * Each existed in the backend with no screen, which meant a reviewer had to
 * take the milestone's claim on trust rather than watching it happen.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8000";
const MESSY = path.join(__dirname, "9_hoja_recepcion.xlsx");

async function clinicId(request: APIRequestContext): Promise<string> {
  const clinics = await (await request.get(`${API}/review/clinics`)).json();
  return clinics[0].id;
}

/** A doctor who actually has availability rules, found rather than assumed. */
async function doctorWithRules(
  request: APIRequestContext,
  cid: string,
): Promise<string | null> {
  const doctors = await (
    await request.get(`${API}/review/doctors?clinic_id=${cid}&limit=25`)
  ).json();
  for (const doctor of doctors.items) {
    const detail = await (
      await request.get(`${API}/review/doctors/${doctor.id}?clinic_id=${cid}`)
    ).json();
    if (detail.availability_rules.length > 0) return doctor.id;
  }
  return null;
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Contraseña").fill("admin-local-only");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Sesión de administrador iniciada.")).toBeVisible({
    timeout: 20000,
  });
}

test.describe("availability, made visible", () => {
  test("a doctor's page shows the rules the engine computes from", async ({
    page,
    request,
  }) => {
    const cid = await clinicId(request);
    const doctorId = await doctorWithRules(request, cid);
    test.skip(doctorId === null, "no doctor has availability rules");

    await page.goto(`/doctors/${doctorId}`);

    await expect(page.getByText("Horario semanal").first()).toBeVisible();
    // The decision stated where its consequence is visible: these rules are
    // the source, and the slots below are derived from them every time.
    await expect(page.getByText(/se calculan con estas reglas cada vez/)).toBeVisible();
    await expect(page.getByText("Excepciones").first()).toBeVisible();
  });

  test("the slot finder shows real computed times", async ({ page, request }) => {
    const cid = await clinicId(request);
    const doctorId = await doctorWithRules(request, cid);
    test.skip(doctorId === null, "no doctor has availability rules");

    await page.goto(`/doctors/${doctorId}`);
    await page.getByRole("button", { name: /Buscar horarios/ }).click();

    // Slots, not a stored list: computed from the rules on this request.
    await expect(page.getByText(/horarios disponibles/)).toBeVisible({ timeout: 30000 });
  });

  test("an impossible window produces the fallback, not an error", async ({
    page,
    request,
  }) => {
    const cid = await clinicId(request);
    const doctorId = await doctorWithRules(request, cid);
    test.skip(doctorId === null, "no doctor has availability rules");

    await page.goto(`/doctors/${doctorId}`);
    // A window no clinic works. The engine finds nothing, which is M2's second
    // exit criterion rather than a failure.
    await page.locator('input[name="earliest"]').fill("23:00");
    await page.locator('input[name="latest"]').fill("23:30");
    await page.getByRole("button", { name: /Buscar horarios/ }).click();

    await expect(page.getByText(/se escala a una persona/)).toBeVisible({
      timeout: 30000,
    });
  });

  test("the doctors list links to each schedule", async ({ page }) => {
    await page.goto("/doctors");
    await page.locator("td a").first().click();

    await expect(page).toHaveURL(/\/doctors\/[0-9a-f-]+/);
    await expect(page.getByText("Citas próximas")).toBeVisible();
  });
});

test.describe("phones shared between patients", () => {
  test("a receptionist is refused, because a row names several patients", async ({
    page,
  }) => {
    await page.goto("/handsets");

    await expect(page.getByText(/requiere una sesión de administrador/)).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Ingresar" }),
    ).toBeVisible();
  });

  test("an administrator sees each shared number and who is on it", async ({
    page,
    request,
  }) => {
    const cid = await clinicId(request);
    const shared = await (
      await request.get(`${API}/review/phone-bindings/shared?clinic_id=${cid}`)
    ).json();
    test.skip(shared.length === 0, "no shared handsets in this data");

    await signIn(page);
    await page.goto("/handsets");

    await expect(page.getByText("Teléfonos compartidos").first()).toBeVisible();
    // Why it matters, said on the screen: a reminder here is read by whoever
    // answers, which is what M4's dispatch gate has to consult this for.
    await expect(page.getByText(/lo lee quien contesta/)).toBeVisible();
    // The number itself is encrypted and never returned — only a reference.
    await expect(page.getByText(/Referencia/).first()).toBeVisible();
  });
});

test.describe("reviewing a single import row", () => {
  test("rows needing a person are listed with the reason", async ({ page }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });

    // The rows are populated by conversion, so validate first.
    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(
      page.getByText(/Todo listo para importar|Hay cosas por resolver/),
    ).toBeVisible({ timeout: 60000 });

    await page.getByRole("link", { name: /Ver filas por revisar/ }).click();
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+\/rows/);

    await expect(page.getByText("Filas por revisar").first()).toBeVisible();
    // Without this screen, one bad cell in a 2,000-row export means asking the
    // clinic for a new file rather than fixing the cell.
    await expect(page.getByRole("button", { name: /Corregir/ }).first()).toBeVisible();
  });

  test("correcting a row opens a dialog that keeps the file's own value", async ({
    page,
  }) => {
    test.skip(!existsSync(MESSY), "fixture not generated");

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(MESSY);
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]+/, { timeout: 60000 });
    await page.getByRole("button", { name: "Revisar todas las filas" }).click();
    await expect(
      page.getByText(/Todo listo para importar|Hay cosas por resolver/),
    ).toBeVisible({ timeout: 60000 });

    await page.getByRole("link", { name: /Ver filas por revisar/ }).click();
    await page.getByRole("button", { name: /Corregir/ }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Says the original is kept: the log's job is to record what arrived, not
    // what somebody wished had arrived.
    await expect(dialog.getByText(/valor original del archivo se conserva/)).toBeVisible();
    // Dismissed rather than submitted: this test is about the dialog.
    await dialog.getByRole("button", { name: /No, volver/ }).click();
    await expect(dialog).toBeHidden();
  });
});
