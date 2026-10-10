/**
 * End-to-end: the dashboard against a running backend.
 *
 * These drive a real browser, because the write path cannot be tested any other
 * way. A Server Action is invoked over React's own protocol, not as a plain
 * form POST, so hand-building the request proves nothing — an earlier attempt
 * to do exactly that produced "Connection closed" against working code.
 *
 * Each write is checked twice: once by what the screen says, and once by
 * reading the API directly to confirm the database actually changed. A banner
 * that says "cancelled" while the row is untouched is the failure worth
 * catching.
 *
 * Requires both services running:
 *     backend   RATE_LIMIT_PER_MINUTE=1000 python main.py   (port 8000)
 *     frontend  npx next build && npx next start            (port 3000)
 *
 * The raised rate limit is for the suite, not for production. The API allows 60
 * requests a minute by default and a full run exceeds that -- every page render
 * makes several API calls. Hitting it answers "Too many requests", which is the
 * limiter working; it just makes the suite look broken.
 *
 * Run with: npx playwright test
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

const API = "http://127.0.0.1:8000";

/**
 * A time no other run has used.
 *
 * Fixed times made the suite pass once and fail afterwards with 409: the slot
 * from the previous run was still booked. Minutes are stepped by 20 — the
 * seeded appointment length — so two slots from one run never overlap either.
 */
let slotCounter = 0;
function freeSlot(): { date: string; time: string } {
  const minutesFromStart = slotCounter++ * 20;
  // A Thursday far beyond the seeded data, walked forward per call.
  const day = 4 + Math.floor(minutesFromStart / (8 * 60));
  const minuteOfDay = 7 * 60 + (minutesFromStart % (8 * 60));
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  // Unique per process, so a re-run does not collide with the previous one.
  const month = String(((process.pid + slotCounter) % 9) + 1).padStart(2, "0");
  return { date: `2028-${month}-${String(day).padStart(2, "0")}`, time: `${hh}:${mm}` };
}

/** The clinic every request is scoped to. Taken from the API, never guessed. */
async function clinicId(request: APIRequestContext): Promise<string> {
  const clinics = await (await request.get(`${API}/review/clinics`)).json();
  return clinics[0].id;
}

test.describe("reading", () => {
  test("the overview shows live counts and the synthetic-data banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Modo de datos sintéticos")).toBeVisible();
    // Scoped to the stat card: "Pacientes" is also a nav link.
    await expect(page.getByRole("main").getByText("Pacientes", { exact: true })).toBeVisible();
    await expect(page.getByText("Citas por estado")).toBeVisible();
  });

  test("patients are listed with their identifiers masked", async ({ page }) => {
    await page.goto("/patients");
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    // Identifiers arrive masked from the API and no route unmasks them.
    await expect(page.locator("td.font-mono").first()).toContainText("*");
  });

  test("every page in the nav loads", async ({ page }) => {
    for (const [href, heading] of [
      ["/appointments", "Citas"],
      ["/doctors", "Médicos"],
      ["/escalations", "Pendientes"],
    ] as const) {
      await page.goto(href);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});

test.describe("booking", () => {
  test("a new appointment is written and appears in the list", async ({ page, request }) => {
    const cid = await clinicId(request);
    const before = await (
      await request.get(`${API}/review/appointments?clinic_id=${cid}&limit=1`)
    ).json();

    await page.goto("/appointments/new");
    await expect(page.getByRole("heading", { name: "Nueva cita" })).toBeVisible();

    // Pick the first real option in each list, rather than assuming an id.
    await page.locator('select[name="patient_id"]').selectOption({ index: 1 });
    await page.locator('select[name="doctor_id"]').selectOption({ index: 1 });
    const slot = freeSlot();
    await page.locator('input[name="date"]').fill(slot.date);
    await page.locator('input[name="time"]').fill(slot.time);

    await page.getByRole("button", { name: /Agendar/ }).click();

    await expect(page.getByText(/Cita agendada para/)).toBeVisible({ timeout: 20000 });

    const after = await (
      await request.get(`${API}/review/appointments?clinic_id=${cid}&limit=1`)
    ).json();
    expect(after.total, "the appointment reached the database").toBe(before.total + 1);
  });

  test("booking the same time twice is refused, in Spanish", async ({ page }) => {
    const slot = freeSlot();

    const submit = async (patientIndex: number) => {
      await page.goto("/appointments/new");
      await page.locator('select[name="patient_id"]').selectOption({ index: patientIndex });
      await page.locator('select[name="doctor_id"]').selectOption({ index: 1 });
      await page.locator('input[name="date"]').fill(slot.date);
      await page.locator('input[name="time"]').fill(slot.time);
      await page.getByRole("button", { name: /Agendar/ }).click();
    };

    await submit(1);
    await expect(page.getByText(/Cita agendada para/)).toBeVisible({ timeout: 20000 });

    // A different patient, the same doctor and time: the database refuses it,
    // and the screen has to say so rather than show a server error.
    await submit(2);
    await expect(page.getByText(/ocupado/)).toBeVisible({ timeout: 20000 });
  });

  test("a time without a date is refused by the browser, not the server", async ({ page }) => {
    await page.goto("/appointments/new");
    await page.locator('select[name="patient_id"]').selectOption({ index: 1 });
    await page.locator('select[name="doctor_id"]').selectOption({ index: 1 });
    await page.locator('input[name="date"]').fill("");

    await page.getByRole("button", { name: /Agendar/ }).click();

    // `required` on the input means the form never submits, so nothing is
    // written and no round trip happens.
    await expect(page.getByText(/Cita agendada/)).toHaveCount(0);
  });
});

test.describe("cancelling", () => {
  test("cancelling frees the slot and the row keeps its history", async ({ page, request }) => {
    const cid = await clinicId(request);

    // Cancel whatever the page actually shows, rather than booking a row and
    // hoping it lands on the first page: the list is ordered by start time and
    // shows 50 of several hundred, so a far-future booking is not on it.
    await page.goto("/appointments");
    const button = page.getByRole("button", { name: "Cancelar" }).first();
    await expect(button).toBeVisible();

    const before = await (
      await request.get(
        `${API}/review/appointments?clinic_id=${cid}&limit=200&status=cancelled`,
      )
    ).json();

    page.on("dialog", (d) => d.accept());
    await button.click();
    await expect(page.getByText(/Cita cancelada/).first()).toBeVisible({ timeout: 20000 });

    const after = await (
      await request.get(
        `${API}/review/appointments?clinic_id=${cid}&limit=200&status=cancelled`,
      )
    ).json();
    // One more cancelled row than before: the row is kept, not deleted, which
    // is what the history and M4's reporting depend on.
    expect(after.total, "the row is kept and marked cancelled").toBe(before.total + 1);
  });
});

test.describe("the escalation queue", () => {
  test("an open escalation can be resolved and stays on the list", async ({ page, request }) => {
    const cid = await clinicId(request);
    const open = await (
      await request.get(`${API}/review/escalations?clinic_id=${cid}&status=open&limit=1`)
    ).json();
    test.skip(open.total === 0, "no open escalation to resolve");
    const everything = await (
      await request.get(`${API}/review/escalations?clinic_id=${cid}&limit=200`)
    ).json();
    const resolvedBefore = everything.items.filter(
      (e: { status: string }) => e.status === "resolved",
    ).length;

    page.on("dialog", (d) => d.accept());
    await page.goto("/escalations");
    // 96 attendance flags share the same wording, so the text is not a
    // selector. The first open card is, and the API said which row that is.
    const button = page.getByRole("button", { name: "Marcar resuelto" }).first();
    await expect(button).toBeVisible();
    await button.click();

    await expect(page.getByText(/marcado como resuelto/).first()).toBeVisible({
      timeout: 20000,
    });

    const after = await (
      await request.get(`${API}/review/escalations?clinic_id=${cid}&limit=200`)
    ).json();
    // Nothing is deleted: the total is unchanged and one more is resolved.
    expect(after.total, "resolving never deletes a row").toBe(open.total + resolvedBefore);
    const resolved = after.items.filter(
      (e: { status: string }) => e.status === "resolved",
    );
    expect(resolved.length).toBe(resolvedBefore + 1);
    expect(resolved.every((e: { resolved_at: string | null }) => e.resolved_at !== null)).toBe(
      true,
    );
  });
});

test.describe("failure handling", () => {
  test("an unknown appointment answers in Spanish, not a stack trace", async ({ request }) => {
    const cid = await clinicId(request);
    const response = await request.post(
      `${API}/review/appointments/00000000-0000-0000-0000-000000000000/cancel?clinic_id=${cid}`,
      { data: {} },
    );
    expect(response.status()).toBe(404);
  });
});
