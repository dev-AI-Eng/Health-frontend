import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
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
import { listDoctors } from "@/lib/api";
import { intlLocale, translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: a build-time snapshot would show a stale clinic. */
export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const result = await load("doctors", (clinic) => listDoctors(clinic.id, { limit: 100 }));

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const nf = new Intl.NumberFormat(intlLocale(locale));

  return (
    <>
      <PageHeading
        title={t("doctors.title")}
        subtitle={`${nf.format(page.total)} ${t("appointments.total")}`}
      />

      <Card className="overflow-hidden py-0">
        {page.items.length === 0 ? (
          <Empty icon={<Stethoscope className="size-5" />}>{t("doctors.empty")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("doctors.col.doctor")}</TableHead>
                  <TableHead>{t("doctors.col.specialty")}</TableHead>
                  <TableHead>{t("doctors.col.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium">
                      {/* Links to the schedule behind them: the weekly rules,
                          the dated exceptions, and what they can offer. */}
                      <Link
                        href={`/doctors/${doctor.id}`}
                        className="hover:text-primary underline-offset-4 transition-colors hover:underline"
                      >
                        {doctor.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doctor.specialty || "—"}
                    </TableCell>
                    <TableCell>
                      {/* An inactive doctor keeps their history but takes no new
                          appointments, so the distinction matters here. */}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ring-1 ring-inset",
                          doctor.active ? "status-confirmed" : "status-cancelled",
                        )}
                      >
                        {doctor.active ? t("doctors.active") : t("doctors.inactive")}
                      </Badge>
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
