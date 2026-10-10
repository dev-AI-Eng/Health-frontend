import Link from "next/link";
import { Users } from "lucide-react";

import { ApiFailure, Empty, MaskNotice, PageHeading } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPatients } from "@/lib/api";
import { intlLocale, translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";

/** Rendered per request: a build-time snapshot would show a stale clinic. */
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const [locale, role] = await Promise.all([currentLocale(), currentRole()]);
  const t = translator(locale);
  const result = await load("patients", (clinic) => listPatients(clinic.id, { limit: 50 }));

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const nf = new Intl.NumberFormat(intlLocale(locale));
  // The API's own flag decides, so the notice can never disagree with the data
  // beside it. The role is the fallback for an empty page, which has no row to
  // read the flag from but should still say what this viewer would see.
  const masked = page.items[0]?.identifiers_masked ?? role !== "admin";

  return (
    <>
      <PageHeading
        title={t("patients.title")}
        subtitle={`${nf.format(page.total)} ${t("appointments.total")} · ${t("appointments.showing")} ${page.items.length}`}
      />

      <MaskNotice masked={masked} locale={locale} />

      <Card className="overflow-hidden py-0">
        {page.items.length === 0 ? (
          <Empty icon={<Users className="size-5" />}>{t("patients.empty")}</Empty>
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
