/**
 * The failure path, checked without a server.
 *
 * Run with `node --test` (Node's own runner, no framework installed).
 *
 * What this guards: nothing shown on a clinic's screen may be English, and
 * nothing shown there may name our host, our port or a command to run. That
 * went wrong once -- the first version of these screens printed "Is the
 * backend running on http://127.0.0.1:8000?" to the user -- so it is worth a
 * test rather than a convention.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, listClinics } from "./api.ts";
import { NoClinicError, UnknownClinicError } from "./clinic.ts";
import { spanishOf } from "./load.ts";

/**
 * Anything that would be an internal detail leaking onto a screen.
 *
 * "error" alone is not on this list: it is an ordinary Spanish word, and
 * "Ocurrio un error inesperado" is the correct thing to say. What must not
 * appear is an English *class* name, so those are matched specifically.
 */
const LEAKS = [
  "127.0.0.1",
  "localhost",
  ":8000",
  "python",
  "main.py",
  "CLINIC_ID",
  "http://",
  "GET /",
  "undefined",
  "TypeError",
  "SyntaxError",
  "ApiError",
  "fetch failed",
  "ECONNREFUSED",
];

/** A Spanish sentence, by the only markers that are cheap to check for. */
function assertSpanish(text: string, label: string) {
  assert.ok(text.length > 0, `${label}: empty`);
  assert.ok(
    /[áéíóúñ¿]/i.test(text) || /\b(no|el|la|de|en|intente|avise)\b/i.test(text),
    `${label}: does not read as Spanish: ${text}`,
  );
  for (const leak of LEAKS) {
    assert.ok(
      !text.toLowerCase().includes(leak.toLowerCase()),
      `${label}: leaks "${leak}": ${text}`,
    );
  }
}

/**
 * Drive the real request path with a stubbed `fetch`.
 *
 * `listClinics` is a one-line wrapper over the private `get`, so calling it
 * exercises the actual error construction. Asserting against a hand-built
 * `ApiError` would not: an earlier version of this test did exactly that, and
 * it passed while the code put our host back on the screen.
 */
async function failingCall(stub: () => Promise<Response>): Promise<ApiError> {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  try {
    await listClinics();
    throw new Error("expected the call to fail");
  } catch (error) {
    assert.ok(error instanceof ApiError, `not an ApiError: ${String(error)}`);
    return error;
  } finally {
    globalThis.fetch = original;
  }
}

/** A `Response` carrying a status and the API's own error envelope. */
function errorResponse(status: number): Response {
  return new Response(JSON.stringify({ detail: "boom", request_id: "req-123" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("an unreachable API shows Spanish and logs the English detail", async () => {
  const error = await failingCall(() => Promise.reject(new TypeError("fetch failed")));
  assertSpanish(error.spanish, "unreachable");
  // The English detail is kept, not discarded: it is what the log needs.
  assert.match(error.message, /unreachable/);
  assert.match(error.message, /127\.0\.0\.1/);
});

test("a timeout shows Spanish and logs the English detail", async () => {
  const error = await failingCall(() => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    return Promise.reject(timeout);
  });
  assertSpanish(error.spanish, "timeout");
  assert.match(error.message, /timed out/);
});

test("every status the API can answer with is worded in Spanish", async () => {
  for (const status of [400, 404, 422, 500, 503]) {
    const error = await failingCall(() => Promise.resolve(errorResponse(status)));
    assertSpanish(error.spanish, `status ${status}`);
    assert.equal(error.status, status);
    // The API's own `detail` is English and may quote internals: log only.
    assert.match(error.message, /boom/);
    assert.ok(!error.spanish.includes("boom"), `status ${status}: detail reached the screen`);
    // The request id is what matches this screen to a backend log line.
    assert.equal(error.requestId, "req-123");
  }
});

test("the clinic misconfiguration errors are worded for a person", () => {
  assertSpanish(new NoClinicError().spanish, "NoClinicError");
  assertSpanish(new UnknownClinicError("abc-123").spanish, "UnknownClinicError");
  // The id belongs in the log line, not on the screen.
  assert.match(new UnknownClinicError("abc-123").message, /abc-123/);
  assert.ok(!new UnknownClinicError("abc-123").spanish.includes("abc-123"));
});

test("an unexpected error falls back to Spanish rather than its own message", () => {
  // A bug we did not anticipate: its message is English and about our code.
  const spanish = spanishOf(new TypeError("Cannot read properties of undefined"));
  assertSpanish(spanish, "TypeError");

  // Things that are not Errors at all still get a sentence.
  for (const thrown of [undefined, null, "boom", 42, {}]) {
    assertSpanish(spanishOf(thrown), `thrown ${String(thrown)}`);
  }
});

test("an error carrying its own Spanish is used verbatim", () => {
  const error = new ApiError(500, "/x", "English for the log", "El sistema no pudo responder.");
  assert.equal(spanishOf(error), "El sistema no pudo responder.");
});


test("a 409 shows the API's own Spanish, not a generic shrug", async () => {
  // The scheduling routes answer 409 with a sentence written for a
  // receptionist: "Ese horario ya está ocupado. Elija otro." The first version
  // of `spanishFor` had no 409 case, so that fell through to "No se pudo
  // obtener la información" -- turning an actionable answer into a shrug.
  // Caught end to end, in a browser, which is why this test exists.
  const error = await failingCall(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ detail: "Ese horario ya está ocupado. Elija otro." }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  assert.equal(error.spanish, "Ese horario ya está ocupado. Elija otro.");
  assertSpanish(error.spanish, "409");
});

test("an English detail never reaches the screen, whatever the status", async () => {
  // FastAPI's own 404 is "Not Found", and the generic 500 handler answers in
  // English too. Those must not be shown just because the status allows it.
  for (const status of [404, 409]) {
    const error = await failingCall(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: "Not Found" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    assertSpanish(error.spanish, `status ${status} with an English detail`);
    assert.ok(!error.spanish.includes("Not Found"));
  }
});

test("a 422 the API wrote shows its own Spanish, so a typo can be fixed", async () => {
  // The patients search answers 422 "El número de teléfono no es válido." for a
  // number that cannot be a phone. It used to be replaced by "Avise al equipo
  // técnico" -- a receptionist who mistyped a digit was told to call IT.
  // Found by typing a bad number into the search box in the running app.
  const error = await failingCall(() =>
    Promise.resolve(
      new Response(JSON.stringify({ detail: "El número de teléfono no es válido." }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    ),
  );

  assert.equal(error.spanish, "El número de teléfono no es válido.");
  assert.ok(!error.spanish.includes("equipo técnico"));
});

test("the framework's own 422 never reaches the screen", async () => {
  // FastAPI answers a malformed query with a LIST of English objects in
  // `detail`. Letting 422 carry its own text must not let that through: it is
  // an array, not a sentence, so it falls back to the generic Spanish line.
  const error = await failingCall(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          detail: [
            { type: "int_parsing", loc: ["query", "limit"], msg: "Input should be a valid integer" },
          ],
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  assertSpanish(error.spanish, "framework 422");
  assert.ok(!error.spanish.includes("Input should be"));
  assert.ok(!error.spanish.includes("int_parsing"));
});
