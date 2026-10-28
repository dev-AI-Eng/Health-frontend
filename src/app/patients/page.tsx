import Link from "next/link";
import { Search, Users } from "lucide-react";

import { ApiFailure, Empty, MaskNotice, PageHeading } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Page, type Patient, listPatients } from "@/lib/api";
import { type Locale, intlLocale, translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";

/** Rendered per request: a build-time snapshot would show a stale clinic. */
export const dynamic = "force-dynamic";

/** A query value as text, or nothing. A repeated parameter arrives as an array. */
function typed(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string | string[]; document_number?: string | string[] }>;
}) {
  const [locale, role, query] = await Promise.all([
    currentLocale(),
    currentRole(),
    searchParams,
  ]);
  const t = translator(locale);
  const phone = typed(query.phone);
  const documentNumber = typed(query.document_number);
  const searching = phone !== undefined || documentNumber !== undefined;

  const result = await load("patients", (clinic) =>
    listPatients(clinic.id, { limit: 50, phone, documentNumber }),
  );

  const nf = new Intl.NumberFormat(intlLocale(locale));
  const page = result.ok ? result.data : null;

  return (
    <>
      <PageHeading
        title={t("patients.title")}
        subtitle={
          page
            ? `${nf.format(page.total)} ${t("appointments.total")} · ${t("appointments.showing")} ${page.items.length}`
            : undefined
        }
      />

      {/* Outside the success branch, on purpose. A phone number the API refuses
          answers 422, and if that replaced the whole page the form would vanish
          with it: the receptionist would see an error and have nowhere to fix
          the number. A plain GET form, so a search is a URL she can reload,
          share or come back to. */}
      <form action="/patients" method="get" className="mb-2 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="document_number">{t("patients.search.document")}</Label>
          <Input
            id="document_number"
            name="document_number"
            defaultValue={documentNumber}
            placeholder="1.020.304.050"
            autoComplete="off"
            className="w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">{t("patients.search.phone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={phone}
            placeholder="300 111 2233"
            autoComplete="off"
            className="w-48"
          />
        </div>
        <Button type="submit">
          <Search className="size-4" />
          {t("patients.search.submit")}
        </Button>
        {searching ? (
          <Button asChild variant="ghost">
            <Link href="/patients">{t("patients.search.clear")}</Link>
          </Button>
        ) : null}
      </form>
      <p className="text-muted-foreground mb-6 text-xs">{t("patients.search.hint")}</p>

      {result.ok && page ? (
        <PatientResults
          page={page}
          searching={searching}
          locale={locale}
          // The API's own flag decides, so the notice can never disagree with
          // the data beside it. The role is the fallback for an empty page,
          // which has no row to read the flag from but should still say what
          // this viewer would see.
          masked={page.items[0]?.identifiers_masked ?? role !== "admin"}
        />
      ) : !result.ok ? (
        <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />
      ) : null}
    </>
  );
}

function PatientResults({
  page,
  searching,
  locale,
  masked,
}: {
  page: Page<Patient>;
  searching: boolean;
  locale: Locale;
  masked: boolean;
}) {
  const t = translator(locale);

  return (
    <>
      <MaskNotice masked={masked} locale={locale} />

      <Card className="overflow-hidden py-0">
        {page.items.length === 0 ? (
          <Empty icon={<Users className="size-5" />}>
            {/* An empty clinic and an empty search are different situations and
                need different words: "no patients yet" is wrong, and alarming,
                when the clinic has two hundred and the number was mistyped. */}
            {searching ? t("patients.noMatch") : t("patients.empty")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("patients.col.patient")}</TableHead>
                  <TableHead>{t("patients.col.document")}</TableHead>
                  <TableHead className="text-right">{t("patients.col.age")}</TableHead>
                  <TableHead>{t("patients.col.mobile")}</TableHead>
                  <TableHead>{t("patients.col.email")}</TableHead>
                  <TableHead>{t("patients.col.eps")}</TableHead>
                  <TableHead>{t("patients.col.secondary")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {/* The row links to everything attached to the patient:
                            consents, phones and their appointments. */}
                        <Link
                          href={`/patients/${patient.id}`}
                          className="hover:text-primary underline-offset-4 transition-colors hover:underline"
                        >
                          {patient.given_names} {patient.family_names}
                        </Link>
                        {/* A minor's appointments are arranged with a guardian,
                            so it changes who the clinic contacts. */}
                        {patient.is_minor ? (
                          <Badge variant="secondary" className="text-[11px]">
                            {t("patients.minor")}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      <span className="text-foreground/70 mr-1.5 font-sans">
                        {patient.document_type}
                      </span>
                      {patient.document_number_masked}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {patient.age ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {patient.phone_masked ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[14rem] truncate text-sm">
                      {patient.email_masked ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {patient.eps ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {patient.secondary_contact_name || patient.secondary_contact_phone_masked ? (
                        <>
                          {patient.secondary_contact_name ? (
                            <span className="block">{patient.secondary_contact_name}</span>
                          ) : null}
                          <span className="text-muted-foreground font-mono text-xs">
                            {patient.secondary_contact_phone_masked ?? ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
