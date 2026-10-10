import Link from "next/link";
import { ArrowLeft, CalendarDays, Info, Phone, ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, Empty, MaskNotice, PageHeading, StatusBadge } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatient } from "@/lib/api-import";
import { intlLocale, translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";

/** Rendered per request: consents and appointments change under it. */
export const dynamic = "force-dynamic";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const [locale, role] = await Promise.all([currentLocale(), currentRole()]);
  const t = translator(locale);

  const result = await load("patients/detail", (clinic) => getPatient(clinic.id, patientId));

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const patient = result.data;
  const masked = patient.identifiers_masked ?? role !== "admin";

  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/patients"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("patient.back")}
      </Link>

      <PageHeading
        title={`${patient.given_names} ${patient.family_names}`}
        subtitle={`${patient.document_type} ${patient.document_number_masked}`}
      />

      <MaskNotice masked={masked} locale={locale} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("patient.birthDate")}
            </p>
            <p className="mt-1.5 text-sm font-medium">
              {patient.birth_date ? date.format(new Date(patient.birth_date)) : "—"}
              {patient.age !== null ? (
                <span className="text-muted-foreground ml-2">({patient.age})</span>
              ) : null}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("patients.col.mobile")}
            </p>
            <p className="mt-1.5 font-mono text-sm">{patient.phone_masked ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("patients.col.email")}
            </p>
            <p className="mt-1.5 truncate text-sm">{patient.email_masked ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            {t("patient.consents")}
          </CardTitle>
          {/* The distinction M1 decided and that M4's dispatch gate relies on:
              an imported consent is evidence that one exists, not permission. */}
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t("patient.consentsHint")}
          </p>
        </CardHeader>
        <CardContent>
          {patient.consents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("patient.noConsents")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {patient.consents.map((consent) => (
                <li
                  key={consent.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{consent.purpose}</p>
                    <p className="text-muted-foreground text-xs">
                      {t("patient.channel")}: {consent.channel} · {t("patient.evidence")}:{" "}
                      {consent.evidence_kind}
                      {consent.granted_at
                        ? ` · ${date.format(new Date(consent.granted_at))}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ring-1 ring-inset",
                      consent.active ? "status-confirmed" : "status-cancelled",
                    )}
                  >
                    {consent.active ? t("patient.active") : t("patient.inactive")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" />
            {t("patient.phones")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patient.phone_bindings.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("patient.noPhones")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {patient.phone_bindings.map((binding) => (
                <li
                  key={binding.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-sm">{binding.phone_masked ?? "—"}</span>
                  <Badge variant="secondary">{binding.relationship_kind}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" />
            {t("patient.appointments")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patient.appointments.length === 0 ? (
            <Empty icon={<CalendarDays className="size-5" />}>
              {t("patient.noAppointments")}
            </Empty>
          ) : (
            <ul className="divide-border divide-y">
              {patient.appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{when.format(new Date(appointment.start))}</p>
                    <p className="text-muted-foreground text-xs">
                      {appointment.doctor_name} · {appointment.location_name}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
