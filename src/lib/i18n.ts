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

  // ---------------------------------------------------- M1: the importer
  "nav.import": ["Importar", "Import"],
  "import.title": ["Importar datos", "Import data"],
  "import.subtitle": [
    "Suba el archivo que la clínica ya usa. Nada se guarda hasta que una persona lo apruebe.",
    "Upload the file the clinic already keeps. Nothing is saved until a person approves it.",
  ],
  "import.drop": ["Arrastre un archivo o selecciónelo", "Drag a file here or choose one"],
  "import.formats": ["CSV o Excel (.xlsx, .xls)", "CSV or Excel (.xlsx, .xls)"],
  "import.choose": ["Seleccionar archivo", "Choose a file"],
  "import.reading": ["Leyendo el archivo…", "Reading the file…"],
  "import.noFile": ["Seleccione un archivo primero.", "Choose a file first."],
  "import.uploadFailed": [
    "No se pudo leer el archivo.",
    "The file could not be read.",
  ],
  "import.recent": ["Importaciones recientes", "Recent imports"],
  "import.profiles": ["Perfiles guardados", "Saved profiles"],
  "import.profilesHint": [
    "Cuando vuelve a llegar un archivo con la misma forma, se reutiliza el mapeo que usted confirmó.",
    "When a file of the same shape arrives again, the mapping you confirmed is reused.",
  ],
  "import.noProfiles": [
    "Todavía no hay perfiles. Se guarda uno al confirmar su primera importación.",
    "No profiles yet. One is saved when you confirm your first import.",
  ],

  // the four steps
  "import.step.read": ["Leer", "Read"],
  "import.step.map": ["Revisar columnas", "Review columns"],
  "import.step.check": ["Revisar filas", "Review rows"],
  "import.step.commit": ["Importar", "Import"],

  // the mapping screen
  "import.file": ["Archivo", "File"],
  "import.sheets": ["Hojas", "Sheets"],
  "import.rows": ["Filas", "Rows"],
  "import.encoding": ["Codificación", "Encoding"],
  "import.delimiter": ["Separador", "Separator"],
  "import.reusedProfile": ["Mapeo reutilizado", "Mapping reused"],
  "import.col.column": ["Columna del archivo", "Column in the file"],
  "import.col.field": ["Campo", "Field"],
  "import.col.quality": ["Convierte", "Converts"],
  "import.col.why": ["Por qué", "Why"],
  "import.unmapped": ["Sin asignar", "Not assigned"],
  "import.ignore": ["Ignorar esta columna", "Ignore this column"],
  "import.entity": ["Esta hoja contiene", "This sheet holds"],
  "import.skipSheet": ["Omitir esta hoja", "Skip this sheet"],
  "import.saveMapping": ["Guardar columnas", "Save columns"],
  "import.savingMapping": ["Guardando…", "Saving…"],
  "import.mappingSaved": ["Columnas guardadas.", "Columns saved."],
  "import.missingRequired": ["Faltan campos obligatorios", "Required fields missing"],
  "import.percentValid": [
    "Porcentaje sobre todas las filas, no sobre una muestra.",
    "Over every row, not a sample.",
  ],

  // questions the file cannot settle
  "import.questions": ["Preguntas sobre el archivo", "Questions about the file"],
  "import.questionsHint": [
    "El archivo no alcanza para decidir esto y el sistema no lo adivina. Rechazar siempre deja la lectura que se habría usado sin preguntar.",
    "The file cannot settle this and the system will not guess. Declining always leaves the reading it would have used unasked.",
  ],
  "import.ifApproved": ["Si aprueba", "If you approve"],
  "import.ifDeclined": ["Si rechaza", "If you decline"],
  "import.approve": ["Aprobar", "Approve"],
  "import.decline": ["Rechazar", "Decline"],
  "import.answered": ["Respondida", "Answered"],
  "import.questionApproved": ["Respuesta guardada: aprobada.", "Answer saved: approved."],
  "import.questionDeclined": ["Respuesta guardada: rechazada.", "Answer saved: declined."],
  "import.columnQuestions": ["Preguntas por columna", "Questions about columns"],

  // validation and commit
  "import.validate": ["Revisar todas las filas", "Check every row"],
  "import.validating": ["Revisando…", "Checking…"],
  "import.readyToCommit": ["Todo listo para importar.", "Ready to import."],
  "import.blocked": ["Hay cosas por resolver antes de importar.", "Some things need resolving first."],
  "import.blocking": ["Falta resolver", "Still to resolve"],
  "import.tolerated": ["Se importará con observaciones", "Will import with notes"],
  "import.valid": ["Listas", "Ready"],
  "import.review": ["Por revisar", "To review"],
  "import.invalid": ["Rechazadas", "Rejected"],
  "import.commit": ["Importar ahora", "Import now"],
  "import.committing": ["Importando…", "Importing…"],
  "import.committed": ["Importación terminada", "Import finished"],
  "import.created": ["Creados", "Created"],
  "import.updated": ["Actualizados", "Updated"],
  "import.skipped": ["Omitidos", "Skipped"],
  "import.conflicts": ["Conflictos", "Conflicts"],
  "import.nothingWritten": [
    "No se escribió nada. Resuelva lo anterior y vuelva a intentar.",
    "Nothing was written. Resolve the above and try again.",
  ],
  "import.viewRows": ["Ver filas por revisar", "See the rows to review"],
  "import.rowNumber": ["Fila", "Row"],
  "import.rowStatus": ["Estado", "Status"],
  "import.rowReason": ["Motivo", "Reason"],
  "import.noRows": ["No hay filas en este estado.", "No rows in this state."],
  "import.backToImport": ["Volver a importar", "Back to import"],

  // the transform log: M1's per-cell evidence
  "log.title": ["Registro de conversión", "Transform log"],
  "log.subtitle": [
    "Cada celda que el importador tocó, con el valor que traía el archivo, el valor en que quedó y la regla que lo decidió.",
    "Every cell the importer touched, with the value the file held, the value it became, and the rule that decided.",
  ],
  "log.all": ["Todas", "All"],
  "log.raw": ["Valor del archivo", "Value in the file"],
  "log.became": ["Quedó como", "Became"],
  "log.rule": ["Regla", "Rule"],
  "log.whatToDo": ["Qué significa y qué hacer", "What it means and what to do"],
  "log.empty": ["No hay celdas en este estado.", "No cells in this state."],
  "log.view": ["Ver registro de conversión", "See the transform log"],

  // ------------------------------------- M2: availability, made visible
  "doctor.back": ["Volver a médicos", "Back to doctors"],
  "doctor.schedule": ["Horario semanal", "Weekly schedule"],
  "doctor.scheduleHint": [
    "Los horarios disponibles se calculan con estas reglas cada vez que alguien pregunta. No se guarda una lista de turnos: una lista queda desactualizada en cuanto el médico cambia su horario o se declara un festivo.",
    "Bookable times are computed from these rules every time somebody asks. No slot list is stored: a list goes stale the moment the doctor changes their hours or a holiday is declared.",
  ],
  "doctor.noRules": [
    "Sin reglas de horario. Este médico no tiene horarios disponibles.",
    "No schedule rules. This doctor has no bookable times.",
  ],
  "doctor.exceptions": ["Excepciones", "Exceptions"],
  "doctor.exceptionsHint": [
    "Días en que el horario normal no aplica: una mañana libre, o horas adicionales.",
    "Days the normal schedule does not apply: a morning off, or extra hours.",
  ],
  "doctor.noExceptions": ["Sin excepciones registradas.", "No exceptions recorded."],
  "doctor.unavailable": ["No disponible", "Unavailable"],
  "doctor.extraHours": ["Horas adicionales", "Extra hours"],
  "doctor.upcoming": ["Citas próximas", "Upcoming appointments"],
  "doctor.allDay": ["Todo el día", "All day"],

  "slots.title": ["Horarios disponibles", "Available times"],
  "slots.subtitle": [
    "Lo que este médico puede ofrecer realmente: se descuentan los festivos colombianos, las excepciones y lo que ya está en su agenda.",
    "What this doctor can genuinely offer: Colombian holidays, exceptions and whatever already occupies their diary are all taken out.",
  ],
  "slots.from": ["Desde", "From"],
  "slots.to": ["Hasta", "To"],
  "slots.type": ["Tipo de cita", "Appointment type"],
  "slots.earliest": ["No antes de", "Not before"],
  "slots.latest": ["No después de", "Not after"],
  "slots.search": ["Buscar horarios", "Find times"],
  "slots.searching": ["Buscando…", "Searching…"],
  "slots.found": ["horarios disponibles", "times available"],
  "slots.none": [
    "No hay horarios que cumplan esos límites. En una conversación real, esto es lo que se escala a una persona.",
    "No times fit those limits. In a real conversation, this is what gets escalated to a person.",
  ],
  "slots.book": ["Agendar este horario", "Book this time"],
  "slots.anyHour": ["Cualquier hora", "Any time"],

  // ----------------------------------- M1: phones shared between patients
  "nav.handsets": ["Teléfonos compartidos", "Shared phones"],
  "handsets.title": ["Teléfonos compartidos", "Shared phones"],
  "handsets.subtitle": [
    "Números con más de un paciente. Un recordatorio enviado aquí lo lee quien contesta, así que M4 debe consultar esta lista antes de enviar.",
    "Numbers with more than one patient on them. A reminder sent here is read by whoever answers, so M4 has to consult this list before sending.",
  ],
  "handsets.adminOnly": [
    "Esta lista nombra varios pacientes juntos, así que requiere una sesión de administrador.",
    "This list names several patients together, so it requires an administrator session.",
  ],
  "handsets.none": [
    "Ningún teléfono está compartido entre pacientes.",
    "No phone is shared between patients.",
  ],
  "handsets.patients": ["pacientes", "patients"],
  "handsets.reference": ["Referencia", "Reference"],
  "handsets.referenceHint": [
    "El número está cifrado y no se devuelve. Esta referencia solo sirve para agrupar.",
    "The number is encrypted and never returned. This reference only groups them.",
  ],

  // ------------------------------------------ M1: reviewing single rows
  "rows.title": ["Filas por revisar", "Rows to review"],
  "rows.subtitle": [
    "Filas que el importador no pudo convertir solo. Corrija una celda aquí, o pida un archivo nuevo si son muchas.",
    "Rows the importer could not convert on its own. Correct a cell here, or ask for a new file if there are many.",
  ],
  "rows.values": ["Valores", "Values"],
  "rows.correct": ["Corregir", "Correct"],
  "rows.correcting": ["Guardando…", "Saving…"],
  "rows.corrected": ["Fila corregida.", "Row corrected."],
  "rows.correctTitle": ["Corregir la fila", "Correct the row"],
  "rows.correctHint": [
    "El valor original del archivo se conserva. Su respuesta se guarda al lado, para que el registro siga sirviendo como evidencia de lo que llegó.",
    "The file's original value is kept. Your answer is stored beside it, so the log keeps working as evidence of what arrived.",
  ],
  "rows.viewRows": ["Ver filas por revisar", "See the rows to review"],

  // ------------------------------------------------- M0: the audit log
  "nav.audit": ["Bitácora", "Audit log"],
  "audit.title": ["Bitácora de accesos", "Access audit log"],
  "audit.subtitle": [
    "Cada lectura y cada escritura de datos de paciente queda registrada. La bitácora no se puede editar ni borrar.",
    "Every read and write of patient data is recorded. The log cannot be edited or deleted.",
  ],
  "audit.adminOnly": [
    "La bitácora nombra pacientes, así que requiere una sesión de administrador.",
    "The log names patients, so it requires an administrator session.",
  ],
  "audit.verifying": [
    "Verificando la cadena de registros…",
    "Verifying the entry chain…",
  ],
  "audit.verifyFailed": [
    "No se pudo verificar la cadena en este momento. Esto no significa que esté alterada.",
    "The chain could not be verified right now. That does not mean it is altered.",
  ],
  "audit.chainIntact": ["Cadena íntegra", "Chain intact"],
  "audit.chainBroken": ["Cadena alterada", "Chain altered"],
  "audit.chainHint": [
    "Cada registro encadena con el anterior. Si alguien edita o borra uno, la verificación lo detecta.",
    "Each entry chains to the one before it. If somebody edits or deletes one, verification detects it.",
  ],
  "audit.rowsChecked": ["registros verificados", "entries verified"],
  "audit.brokenAt": ["Primer registro alterado", "First altered entry"],
  "audit.truncatedAfter": ["Truncada después de", "Truncated after"],
  "audit.col.when": ["Cuándo", "When"],
  "audit.col.who": ["Quién", "Who"],
  "audit.col.action": ["Acción", "Action"],
  "audit.col.what": ["Sobre qué", "On what"],
  "audit.col.why": ["Propósito", "Purpose"],
  "audit.col.fields": ["Campos revelados", "Fields disclosed"],
  "audit.action.read": ["lectura", "read"],
  "audit.action.create": ["creación", "create"],
  "audit.action.update": ["actualización", "update"],
  "audit.action.delete": ["eliminación", "delete"],
  "audit.action.disclose": ["revelación", "disclose"],
  "audit.filter.all": ["Todas las acciones", "All actions"],
  "audit.empty": ["No hay registros todavía.", "No entries yet."],
  "audit.discloseHint": [
    "Una revelación es una consulta de datos completos, sin enmascarar.",
    "A disclosure is a view of full, unmasked data.",
  ],

  // --------------------------------------------- M1/M2: patient detail
  "patient.back": ["Volver a pacientes", "Back to patients"],
  "patient.consents": ["Consentimientos", "Consents"],
  "patient.consentsHint": [
    "Un consentimiento importado es evidencia de que existe, no permiso para enviar mensajes. El permiso se verifica al enviar.",
    "An imported consent is evidence that one exists, not permission to message. Permission is checked at send time.",
  ],
  "patient.noConsents": ["Sin consentimientos registrados.", "No consents recorded."],
  "patient.phones": ["Teléfonos vinculados", "Linked phones"],
  "patient.noPhones": ["Sin teléfonos vinculados.", "No linked phones."],
  "patient.appointments": ["Citas", "Appointments"],
  "patient.noAppointments": ["Sin citas.", "No appointments."],
  "patient.purpose": ["Propósito", "Purpose"],
  "patient.channel": ["Canal", "Channel"],
  "patient.evidence": ["Evidencia", "Evidence"],
  "patient.active": ["Vigente", "Active"],
  "patient.inactive": ["No vigente", "Not active"],
  "patient.relationship": ["Relación", "Relationship"],
  "patient.birthDate": ["Fecha de nacimiento", "Date of birth"],

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
