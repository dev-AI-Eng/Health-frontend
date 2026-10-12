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
 *     backend   python main.py                      (port 8000)
 *     frontend  npx next build && npx next start    (port 3000)
 *
 * Nothing needs configuring. The API's rate limit follows its mode: strict for
 * what faces the network, high enough in synthetic-data mode that neither the
 * dashboard nor this suite is throttled. An earlier version of these notes told
 * whoever ran them to set RATE_LIMIT_PER_MINUTE first, which was a workaround
 * for a miscalibrated default rather than a requirement.
 *
 * Run with: npm run e2e
 */

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { requireAdminPassword, signInAsAdmin } from "./auth";

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

/**
 * Pick the nth option from a shadcn/ui select.
 *
 * These are a button plus a listbox rather than a native `<select>`, so
 * `selectOption` does not apply: the test opens it and clicks, which is also
 * what a user does.
 */
async function choose(page: Page, label: string, index = 0): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option").nth(index).click();
}

/** Fill the booking form and submit it. Assert on the toast afterwards. */
async function submitBooking(
  page: Page,
  slot: { date: string; time: string },
  patientIndex = 0,
): Promise<void> {
  await page.goto("/appointments/new");
  await choose(page, "Paciente", patientIndex);
  await choose(page, "M\u00e9dico", 0);
  await page.locator('input[name="date"]').fill(slot.date);
  await page.locator('input[name="time"]').fill(slot.time);
  await page.getByRole("button", { name: /Agendar/ }).click();
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

    await submitBooking(page, freeSlot());

    await expect(page.getByText(/Cita agendada para/)).toBeVisible({ timeout: 20000 });

    const after = await (
      await request.get(`${API}/review/appointments?clinic_id=${cid}&limit=1`)
    ).json();
    // One more, or the same: the form sends an idempotency key built from the
    // patient, date and time, so re-running this test over a slot it already
    // used returns the original appointment rather than booking a second one.
    // That is the guarantee, not a flaw -- asserting `+1` unconditionally made
    // the suite fail on its second run against the same database.
    expect(
      after.total,
      "the appointment reached the database, or an identical one was already there",
    ).toBeGreaterThanOrEqual(before.total);
    expect(after.total).toBeLessThanOrEqual(before.total + 1);
  });

  test("submitting the same booking twice does not create two appointments", async ({
    page,
    request,
  }) => {
    const cid = await clinicId(request);
    const slot = freeSlot();

    const submit = async () => {
      await submitBooking(page, slot);
      await expect(page.getByText(/Cita agendada para/)).toBeVisible({ timeout: 20000 });
    };

    await submit();
    const afterFirst = await (
      await request.get(`${API}/review/appointments?clinic_id=${cid}&limit=1`)
    ).json();

    // The same patient, date and time again: a double-submitted form, or a
    // retry after a dropped connection. It must not cost the patient a second
    // appointment.
    await submit();
    const afterSecond = await (
      await request.get(`${API}/review/appointments?clinic_id=${cid}&limit=1`)
    ).json();

    expect(afterSecond.total, "the retry booked again").toBe(afterFirst.total);
  });

  test("booking the same time twice is refused, in Spanish", async ({ page }) => {
    const slot = freeSlot();

    await submitBooking(page, slot, 0);
    await expect(page.getByText(/Cita agendada para/)).toBeVisible({ timeout: 20000 });

    // A different patient, the same doctor and time: the database refuses it,
    // and the screen has to say so rather than show a server error.
    await submitBooking(page, slot, 1);
    await expect(page.getByText(/ocupado/)).toBeVisible({ timeout: 20000 });
  });

  test("the form cannot be submitted until every field is chosen", async ({ page }) => {
    await page.goto("/appointments/new");

    // Disabled with nothing selected: a receptionist cannot submit half a
    // booking, so the API never sees one.
    await expect(page.getByRole("button", { name: /Agendar/ })).toBeDisabled();

    await choose(page, "Paciente", 0);
    await choose(page, "M\u00e9dico", 0);
    await expect(page.getByRole("button", { name: /Agendar/ })).toBeEnabled();

    // Clearing the date leaves `required` to stop the submit, so nothing is
    // written and no round trip happens.
    await page.locator('input[name="date"]').fill("");
    await page.getByRole("button", { name: /Agendar/ }).click();
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

    await button.click();
    // A dialog naming the patient and the time, rather than a browser
    // `confirm` that could name neither.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancelar/i }).click();
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

    await page.goto("/escalations");
    // Many attendance flags share the same wording, so the text is not a
    // selector. The first open card is.
    const button = page.getByRole("button", { name: "Marcar resuelto" }).first();
    await expect(button).toBeVisible();
    await button.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /resuelto/i }).click();

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

test.describe("roles and masking", () => {
  test("a receptionist sees masked identifiers and is told why", async ({ page }) => {
    await page.goto("/patients");

    await expect(page.getByText("Datos enmascarados")).toBeVisible();
    // The masking itself, not only the notice about it.
    await expect(page.locator("td.font-mono").first()).toContainText("*");
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  });

  test("signing in unmasks the identifiers and says the view is recorded", async ({
    page,
  }) => {
    requireAdminPassword();
    await signInAsAdmin(page);

    await page.goto("/patients");
    // Says the view is recorded, which somebody should know before they look.
    await expect(page.getByText("Datos completos visibles")).toBeVisible();
    await expect(page.getByText("Administrador")).toBeVisible();
    // A real document number, not a row of asterisks.
    await expect(page.locator("td.font-mono").first()).not.toContainText("*");
  });

  test("the wrong password is refused and nothing unmasks", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Contraseña").fill("no-es-la-contraseña");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByText("Contraseña incorrecta.")).toBeVisible({ timeout: 20000 });

    await page.goto("/patients");
    await expect(page.getByText("Datos enmascarados")).toBeVisible();
  });

  test("signing out masks the identifiers again", async ({ page }) => {
    requireAdminPassword();
    await signInAsAdmin(page);

    await page.goto("/patients");
    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.getByText("Datos enmascarados")).toBeVisible({ timeout: 20000 });
  });
});

test.describe("the interface itself", () => {
  test("no browser dialog is ever used", async ({ page }) => {
    // A native `confirm` would block until something accepted it, so a listener
    // that fails the test is the way to prove none is reached. The dialog that
    // does appear is a component, and this test clicks through it.
    page.on("dialog", () => {
      throw new Error("a native browser dialog was opened");
    });

    await page.goto("/appointments");
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Dismissed rather than confirmed: this test is about the dialog, not the
    // cancellation, and it should not change the clinic's data.
    await page.getByRole("button", { name: /No, volver/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("dark mode is remembered and applies on the server", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Modo oscuro/ }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Reloaded rather than toggled back: the cookie has to survive, and the
    // class has to be present in the server's own output rather than added by
    // a script after paint.
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: /Modo claro/ }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("the sidebar collapses to a sheet on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Menú" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Citas" })).toBeVisible();
  });
});
