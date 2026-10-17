/**
 * M4's manager panel and follow-up list, in a real browser.
 *
 * What is asserted is the *honesty* of the numbers, not that numbers appear.
 * Rev3 requires each formula printed on the report and small groups
 * suppressed, and the reason both matter is the same: a figure without its
 * basis invites a decision it cannot support. A manager who sees "no-show 0%"
 * for a clinic with no appointments believes attendance is perfect.
 */

import { expect, test } from "@playwright/test";

test.describe("the manager panel", () => {
  test("the funnel, the rates and both views are on one page", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByRole("heading", { name: /Informes de gestión/ })).toBeVisible();
    for (const section of [
      "Embudo de citas",
      "Indicadores",
      "No asistencia por zona",
      "Puntualidad por médico",
    ]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }
  });

  test("every rate prints the formula behind it", async ({ page }) => {
    // Rev3 requires the formula on the report. A tooltip is not on the report,
    // and a copy in the frontend is a copy that drifts from the SQL -- so the
    // formulas arrive from the API and are rendered beside the number.
    await page.goto("/reports");

    const main = page.getByRole("main");
    await expect(main.getByText(/confirmados ÷/)).toBeVisible();
    await expect(main.getByText(/completados ÷ total agendado/)).toBeVisible();
    // Four rates, four formulas.
    expect(await main.getByText(/÷/).count()).toBeGreaterThanOrEqual(4);
  });

  test("the funnel is explained as events rather than status", async ({ page }) => {
    // The distinction a manager needs: an appointment rescheduled twice and
    // then attended appears as both, which a status column cannot show.
    await page.goto("/reports");

    await expect(page.getByText(/no de su estado actual/)).toBeVisible();
  });

  test("the zone view states its suppression threshold", async ({ page }) => {
    // A reader who cannot see that data was withheld reads the rest as
    // complete, so the threshold is on the screen rather than in a doc.
    await page.goto("/reports");

    await expect(page.getByText(/se ocultan/)).toBeVisible();
  });

  test("punctuality explains what coverage means", async ({ page }) => {
    // The sentence that stops a mean over four appointments being read as a
    // fact about a doctor.
    await page.goto("/reports");

    await expect(page.getByText(/un promedio sobre 4 de 90/)).toBeVisible();
  });

  test("no map is rendered for the geographic view", async ({ page }) => {
    // Rev3 excludes a map and a distance calculation: a map of patients by
    // neighbourhood is a re-identification surface, and the clinic's question
    // is answered by a sorted table.
    await page.goto("/reports");

    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});

test.describe("the follow-up list", () => {
  test("it opens on the call list, not on everything", async ({ page }) => {
    // The reason a receptionist opens this screen is to find who to ring.
    await page.goto("/follow-up");

    await expect(page.getByRole("heading", { name: /Seguimiento de citas/ })).toBeVisible();
    await expect(page.getByText(/Estos son los pacientes a quienes llamar/)).toBeVisible();
  });

  test("all four states can be filtered", async ({ page }) => {
    await page.goto("/follow-up");

    for (const label of [
      "No respondió",
      "Sin recordatorio aún",
      "Confirmó",
      "Canceló",
      "Todas",
    ]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("the two silent states are explained differently", async ({ page }) => {
    // The distinction that makes this list useful: "reminded and quiet" is a
    // phone call, "not yet reminded" is nothing owed. A single "no reply"
    // count would merge them.
    await page.goto("/follow-up?response=not_yet_reminded");

    await expect(page.getByText(/no se le ha enviado recordatorio/)).toBeVisible();
  });

  test("a patient row links to the record where the number can be unmasked", async ({
    page,
  }) => {
    await page.goto("/follow-up?response=not_yet_reminded");

    const first = page.locator("td a").first();
    if (await first.isVisible()) {
      await first.click();
      await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+/);
    }
  });

  test("both screens are reachable from the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Informes" }).click();
    await expect(page).toHaveURL(/\/reports/);

    await page.getByRole("link", { name: "Seguimiento" }).click();
    await expect(page).toHaveURL(/\/follow-up/);
  });
});
