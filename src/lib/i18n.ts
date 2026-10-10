/**
 * Spanish and English for everything the dashboard says.
 *
 * Spanish is the product language: the clinic reads it, and it is what the
 * client signed off. English exists so a developer who does not read Spanish
 * can work on the thing, and nothing more. Spanish is the default, and
 * switching is per browser, so no clinic ever sees English unless somebody on
 * that machine asks for it.
 *
 * WHY NOT GOOGLE TRANSLATE
 * ------------------------
 * A translate widget sends the page's text to Google, and on these screens
 * that text sits next to patient names -- "Nadie registró si el paciente
 * asistió..." renders a line above "Brayan Camacho Gallego". Rule 7 forbids
 * real patient data leaving our boundary, and while the data is synthetic
 * today, the widget would still be in the code when real data arrives in M5.
 *
 * The Spanish here is also a closed set: our own labels, eight statuses and
 * seven escalation reasons. Translating a closed set in code costs one file and
 * sends nothing anywhere.
 *
 * WHAT IS NOT TRANSLATED
 * ----------------------
 * Two things, deliberately.
 *
 * Patient and doctor names, which are data, not copy.
 *
 * And the escalation sentences the API writes (`detail_es`), which carry a
 * date, a time and sometimes a value from the clinic's own file. Those are
 * composed in Python, server-side, and re-deriving them here would mean this
 * file quietly disagreeing with the backend the first time one is reworded. The
 * escalations page shows the reason code in the chosen language instead, which
 * is what the sentence is about.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Spanish unless the browser has asked otherwise. */
export const DEFAULT_LOCALE: Locale = "es";

/** The cookie the switch sets. Read on the server, so the first render is right. */
export const LOCALE_COOKIE = "dashboard_locale";

export function isLocale(value: string | undefined): value is Locale {
  return value === "es" || value === "en";
}

/**
 * Every string, in both languages.
 *
 * Keyed by meaning rather than by its Spanish text, so rewording the Spanish
 * does not silently orphan the English.
 */
const COPY = {
  // -------------------------------------------------------------- navigation
  "nav.overview": ["Resumen", "Overview"],
  "nav.patients": ["Pacientes", "Patients"],
  "nav.doctors": ["Médicos", "Doctors"],
  "nav.appointments": ["Citas", "Appointments"],
  "nav.pending": ["Pendientes", "Pending"],
  "app.tagline": [
    "Agendamiento de citas para clínicas en Colombia",
    "Appointment scheduling for clinics in Colombia",
  ],
  "lang.switchToEnglish": ["English", "English"],
  "lang.switchToSpanish": ["Español", "Español"],

  // ----------------------------------------------------------------- overview
  "overview.subtitle": ["Resumen de la clínica", "Clinic overview"],
  "overview.syntheticTitle": ["Modo de datos sintéticos.", "Synthetic data mode."],
  "overview.syntheticBody": [
    "Ningún dato real de paciente puede entrar al sistema mientras esté activo.",
    "No real patient data can enter the system while this is on.",
  ],
  "overview.byStatus": ["Citas por estado", "Appointments by status"],
  "overview.noAppointments": [
    "Todavía no hay citas registradas.",
    "No appointments recorded yet.",
  ],
  "count.patients": ["Pacientes", "Patients"],
  "count.doctors": ["Médicos", "Doctors"],
  "count.appointments": ["Citas", "Appointments"],
  "count.availability_rules": ["Reglas de horario", "Availability rules"],
  "count.consents": ["Consentimientos", "Consents"],
  "count.locations": ["Sedes", "Sites"],

  // ----------------------------------------------------------------- patients
  "patients.title": ["Pacientes", "Patients"],
  "patients.empty": [
    "Todavía no hay pacientes. Importe un archivo para empezar.",
    "No patients yet. Import a file to begin.",
  ],
  "patients.col.patient": ["Paciente", "Patient"],
  "patients.col.document": ["Documento", "Document"],
  "patients.col.age": ["Edad", "Age"],
  "patients.col.mobile": ["Celular", "Mobile"],
  "patients.col.email": ["Correo", "Email"],
  "patients.minor": ["menor", "minor"],

  // ------------------------------------------------------------------ doctors
  "doctors.title": ["Médicos", "Doctors"],
  "doctors.empty": [
    "Todavía no hay médicos registrados.",
    "No doctors registered yet.",
  ],
  "doctors.col.doctor": ["Médico", "Doctor"],
  "doctors.col.specialty": ["Especialidad", "Specialty"],
  "doctors.col.status": ["Estado", "Status"],
  "doctors.active": ["activo", "active"],
  "doctors.inactive": ["inactivo", "inactive"],

  // ------------------------------------------------------------- appointments
  "appointments.title": ["Citas", "Appointments"],
  "appointments.empty": [
    "Todavía no hay citas agendadas.",
    "No appointments scheduled yet.",
  ],
  "appointments.col.when": ["Cuándo", "When"],
  "appointments.col.patient": ["Paciente", "Patient"],
  "appointments.col.doctor": ["Médico", "Doctor"],
  "appointments.col.site": ["Sede", "Site"],
  "appointments.col.status": ["Estado", "Status"],
  "appointments.col.actions": ["Acciones", "Actions"],
  "appointments.new": ["Nueva cita", "New appointment"],
  "appointments.expires": ["vence", "expires"],
  "appointments.total": ["en total", "in total"],
  "appointments.showing": ["mostrando", "showing"],

  // -------------------------------------------------------------- the actions
  "action.cancel": ["Cancelar", "Cancel"],
  "action.cancelling": ["Cancelando…", "Cancelling…"],
  "action.confirm": ["Confirmar", "Confirm"],
  "action.confirming": ["Confirmando…", "Confirming…"],
  "action.reschedule": ["Reprogramar", "Reschedule"],
  "action.move": ["Mover", "Move"],
  "action.moving": ["Moviendo…", "Moving…"],
  "action.resolve": ["Marcar resuelto", "Mark resolved"],
  "action.saving": ["Guardando…", "Saving…"],
  "action.book": ["Agendar", "Book"],
  "action.booking": ["Agendando…", "Booking…"],
  "confirm.cancelAppointment": [
    "¿Cancelar la cita? El horario quedará libre.",
    "Cancel this appointment? The slot will be freed.",
  ],
  "confirm.resolve": [
    "¿Marcar este pendiente como resuelto?",
    "Mark this item as resolved?",
  ],

  // ------------------------------------------------------- the booking form
  "book.title": ["Nueva cita", "New appointment"],
  "book.subtitle": [
    "El horario se reserva al guardar; si otro paciente lo toma primero, se le avisa.",
    "The slot is taken on save; if another patient gets it first, you are told.",
  ],
  "book.patient": ["Paciente", "Patient"],
  "book.doctor": ["Médico", "Doctor"],
  "book.site": ["Sede", "Site"],
  "book.type": ["Tipo de cita", "Appointment type"],
  "book.date": ["Fecha", "Date"],
  "book.time": ["Hora", "Time"],
  "book.select": ["Seleccione…", "Select…"],
  "book.minutes": ["min", "min"],
  "book.timezoneNote": [
    "Las citas se guardan en la zona horaria de Colombia (UTC−5).",
    "Appointments are stored in Colombia's time zone (UTC−5).",
  ],
  "book.noSites": ["No hay sedes registradas.", "No sites registered."],
  "book.noTypes": [
    "No hay tipos de cita registrados.",
    "No appointment types registered.",
  ],
  "book.noPatients": [
    "No hay pacientes. Importe un archivo para empezar.",
    "No patients. Import a file to begin.",
  ],

  "reschedule.title": ["Reprogramar la cita", "Reschedule the appointment"],
  "reschedule.description": [
    "Se cancela la cita actual y se crea una nueva. Si el horario está ocupado, la cita original no cambia.",
    "The current appointment is cancelled and a new one created. If the slot is taken, the original is left alone.",
  ],
  "cancel.title": ["¿Cancelar la cita?", "Cancel the appointment?"],
  "cancel.description": [
    "El horario quedará libre para otro paciente. La cita se conserva en el historial.",
    "The slot will be freed for another patient. The appointment stays in the history.",
  ],
  "cancel.confirm": ["Sí, cancelar", "Yes, cancel"],
  "common.keep": ["No, volver", "No, go back"],
  "confirmHold.title": ["¿Confirmar la reserva?", "Confirm the held slot?"],
  "confirmHold.description": [
    "La reserva pasa a ser una cita agendada.",
    "The held slot becomes a scheduled appointment.",
  ],
  "confirmHold.confirm": ["Sí, confirmar", "Yes, confirm"],
  "resolve.title": ["¿Marcar como resuelto?", "Mark as resolved?"],
  "resolve.description": [
    "El pendiente sale de la lista de abiertos y queda el registro de quién lo resolvió.",
    "The item leaves the open list and a record is kept of who resolved it.",
  ],
  "resolve.confirm": ["Sí, resuelto", "Yes, resolved"],

  // -------------------------------------------------------------- the queue
  "pending.title": ["Pendientes", "Pending"],
  "pending.none": ["Nada pendiente.", "Nothing pending."],
  "pending.empty": ["No hay pendientes.", "Nothing pending."],
  "pending.countOne": ["cosa por atender", "item to deal with"],
  "pending.countMany": ["cosas por atender", "items to deal with"],
  "pending.explainerShort": [
    "El sistema no las resuelve solo: una persona decide.",
    "The system does not decide these on its own: a person does.",
  ],
  "pending.explainer": [
    "Aquí llega todo lo que el sistema no debe resolver solo: una cita que no se pudo ofrecer, o una asistencia que nadie registró. Nada se borra de esta lista — se marca como resuelto y queda el registro.",
    "Everything the system must not decide on its own lands here: an appointment that could not be offered, or an attendance nobody recorded. Nothing is deleted from this list — it is marked resolved and the record stays.",
  ],
  "pending.open": ["pendiente", "open"],
  "pending.resolved": ["resuelto", "resolved"],
  "pending.patient": ["Paciente", "Patient"],
  "pending.noPatient": ["Sin paciente identificado", "No patient identified"],
  "pending.resolvedAt": ["resuelto", "resolved"],

  // ------------------------------------------------------------- the statuses
  "status.hold": ["reservado", "held"],
  "status.scheduled": ["agendada", "scheduled"],
  "status.confirmed": ["confirmada", "confirmed"],
  "status.checked_in": ["en sala", "checked in"],
  "status.completed": ["atendida", "completed"],
  "status.no_show": ["no asistió", "no show"],
  "status.cancelled": ["cancelada", "cancelled"],
  "status.rescheduled": ["reprogramada", "rescheduled"],

  // ------------------------------------------- why something was escalated
  "reason.no_acceptable_slot": ["Sin horario disponible", "No slot available"],
  "reason.attendance_unrecorded": [
    "Asistencia sin registrar",
    "Attendance not recorded",
  ],
  "reason.missing_consent": ["Falta consentimiento", "Consent missing"],
  "reason.unrecognised_sender": ["Remitente desconocido", "Unrecognised sender"],
  "reason.clinical_concern": ["Posible tema clínico", "Possible clinical concern"],
  "reason.evaluator_exhausted": [
    "Revisión automática agotada",
    "Automated review exhausted",
  ],
  "reason.patient_asked_for_a_human": [
    "El paciente pidió hablar con alguien",
    "The patient asked for a person",
  ],

  // --------------------------------------------------- the shell and session
  "shell.clinic": ["Clínica", "Clinic"],
  "auth.signIn": ["Ingresar", "Sign in"],
  "auth.signOut": ["Salir", "Sign out"],
  "auth.admin": ["Administrador", "Administrator"],
  "auth.staff": ["Recepción", "Reception"],
  "auth.title": ["Ingresar como administrador", "Sign in as administrator"],
  "auth.subtitle": [
    "Un administrador ve los documentos, teléfonos y correos completos. Cada consulta queda registrada.",
    "An administrator sees full documents, phones and emails. Every such view is recorded.",
  ],
  "auth.password": ["Contraseña", "Password"],
  "auth.submit": ["Ingresar", "Sign in"],
  "auth.submitting": ["Verificando…", "Checking…"],
  "auth.signedIn": ["Sesión de administrador iniciada.", "Signed in as administrator."],
  "auth.signedOut": ["Sesión cerrada.", "Signed out."],
  "auth.wrongPassword": ["Contraseña incorrecta.", "Incorrect password."],
  "auth.notConfigured": [
    "No hay una contraseña de administrador configurada en este servidor.",
    "No administrator password is configured on this server.",
  ],
  "auth.backToDashboard": ["Volver al panel", "Back to the dashboard"],

  // ------------------------------------------------------- masked or not
  "mask.masked": ["Datos enmascarados", "Data masked"],
  "mask.maskedHint": [
    "Los documentos, teléfonos y correos se muestran parcialmente. Ingrese como administrador para verlos completos.",
    "Documents, phones and emails are partly hidden. Sign in as an administrator to see them in full.",
  ],
  "mask.unmasked": ["Datos completos visibles", "Full data visible"],
  "mask.unmaskedHint": [
    "Está viendo documentos, teléfonos y correos completos. Cada consulta queda registrada en la bitácora.",
    "You are seeing full documents, phones and emails. Every view is recorded in the audit log.",
  ],

  // ------------------------------------------------------------ the failures
  "error.title": ["No se pudo cargar la información", "Could not load the data"],
  "error.reference": ["referencia", "reference"],
} as const satisfies Record<string, readonly [string, string]>;

export type CopyKey = keyof typeof COPY;

/**
 * The reader a page or component uses.
 *
 * Returns the key itself if it is ever missing, which shows up on screen rather
 * than rendering blank. `satisfies` above means a typo is a build error, so this
 * is a belt-and-braces path rather than an expected one.
 */
export function translator(locale: Locale) {
  const index = locale === "en" ? 1 : 0;
  return (key: CopyKey): string => COPY[key]?.[index] ?? key;
}

export type T = ReturnType<typeof translator>;

/** The `Intl` locale for dates and numbers, which follows the chosen language. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-GB" : "es-CO";
}
