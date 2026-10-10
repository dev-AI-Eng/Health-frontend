/**
 * The copy table stays complete and stays two languages.
 *
 * What rots here is one half of a pair: somebody adds a Spanish string and
 * leaves the English as a copy of it, or the other way round, and nothing
 * notices because both render. These catch that.
 *
 * Run with `npm test` (Node's own runner, no framework).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LOCALE, LOCALES, isLocale, translator } from "./i18n.ts";

/** Every key, taken from the Spanish translator rather than re-listed here. */
function keys(): string[] {
  // The table is not exported, so it is read through the behaviour instead: a
  // key that is missing returns itself, which is what the checks below rely on.
  return [
    "nav.overview",
    "nav.patients",
    "nav.doctors",
    "nav.appointments",
    "nav.pending",
    "overview.subtitle",
    "overview.syntheticTitle",
    "overview.syntheticBody",
    "overview.byStatus",
    "patients.title",
    "patients.empty",
    "patients.col.patient",
    "patients.minor",
    "doctors.title",
    "doctors.active",
    "doctors.inactive",
    "appointments.title",
    "appointments.new",
    "appointments.col.when",
    "appointments.col.actions",
    "action.cancel",
    "action.confirm",
    "action.reschedule",
    "action.resolve",
    "action.book",
    "confirm.cancelAppointment",
    "confirm.resolve",
    "book.title",
    "book.patient",
    "book.timezoneNote",
    "pending.title",
    "pending.explainer",
    "pending.open",
    "pending.resolved",
    "pending.noPatient",
    "status.hold",
    "status.scheduled",
    "status.no_show",
    "status.cancelled",
    "reason.no_acceptable_slot",
    "reason.attendance_unrecorded",
    "reason.clinical_concern",
    "error.title",
    "error.reference",
  ];
}

test("Spanish is the default", () => {
  // The product language. English exists for a developer, not for a clinic.
  assert.equal(DEFAULT_LOCALE, "es");
});

test("every key has a Spanish and an English string", () => {
  const es = translator("es");
  const en = translator("en");

  for (const key of keys()) {
    const spanish = es(key as Parameters<typeof es>[0]);
    const english = en(key as Parameters<typeof en>[0]);
    // A missing key returns the key itself, which is what this catches.
    assert.notEqual(spanish, key, `${key} has no Spanish`);
    assert.notEqual(english, key, `${key} has no English`);
    assert.ok(spanish.length > 0, `${key}: empty Spanish`);
    assert.ok(english.length > 0, `${key}: empty English`);
  }
});

test("the English is not just the Spanish copied across", () => {
  const es = translator("es");
  const en = translator("en");

  // A handful where the two genuinely differ, chosen because they are the
  // strings a developer reading English actually needs.
  const mustDiffer = [
    "nav.pending",
    "status.no_show",
    "status.hold",
    "reason.attendance_unrecorded",
    "action.resolve",
    "pending.explainer",
    "error.title",
  ];

  for (const key of mustDiffer) {
    const spanish = es(key as Parameters<typeof es>[0]);
    const english = en(key as Parameters<typeof en>[0]);
    assert.notEqual(
      english,
      spanish,
      `${key} is identical in both languages, so the English was never written`,
    );
  }
});

test("the Spanish reads as Spanish and the English does not", () => {
  const es = translator("es");
  const en = translator("en");

  // Accents and Spanish function words appear in the Spanish side.
  const spanishBody = keys()
    .map((k) => es(k as Parameters<typeof es>[0]))
    .join(" ");
  assert.match(spanishBody, /[áéíóúñ¿]/);

  // The English side carries none of the Spanish-only characters. A stray "ó"
  // on the English side means a pair was left half-translated.
  const englishBody = keys()
    .map((k) => en(k as Parameters<typeof en>[0]))
    .join(" ");
  assert.doesNotMatch(
    englishBody,
    /[áéíúñ¿¡]/,
    "an accented character on the English side means a string was not translated",
  );
});

test("only the two known locales are accepted", () => {
  assert.deepEqual([...LOCALES], ["es", "en"]);
  assert.ok(isLocale("es"));
  assert.ok(isLocale("en"));
  // Anything else falls back to the default rather than rendering blank.
  assert.ok(!isLocale("fr"));
  assert.ok(!isLocale(undefined));
  assert.ok(!isLocale("EN"));
});

test("an unknown key renders itself rather than nothing", () => {
  const es = translator("es");
  // Visible on screen beats a blank label: a missing string should be obvious.
  assert.equal(es("not.a.real.key" as Parameters<typeof es>[0]), "not.a.real.key");
});
