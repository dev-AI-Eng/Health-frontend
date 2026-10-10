import { listPatients } from "@/lib/api";
import { load } from "@/lib/load";
import { ApiFailure, Card, Empty, PageHeading, Table, Td } from "@/components/ui";
import { intlLocale, translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

/**
 * Rendered per request, never prerendered.
 *
 * The data is a live clinic: a build-time snapshot would show whoever opens
 * the page the patients that existed when it was built. Marking the route
 * dynamic is the correctness requirement here, not a performance trade.
 */
export const dynamic = "force-dynamic";



export default async function PatientsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const head = [
    t("patients.col.patient"),
    t("patients.col.document"),
    t("patients.col.age"),
    t("patients.col.mobile"),
    t("patients.col.email"),
  ];
  const result = await load("patients", (clinic) =>
    listPatients(clinic.id, { limit: 50 }),
  );
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;

  return (
    <>
      <PageHeading
        title={t("patients.title")}
        subtitle={`${page.total.toLocaleString(intlLocale(locale))} ${t("appointments.total")} · ${t("appointments.showing")} ${page.items.length}`}
      />

      <Card>
        {page.items.length === 0 ? (
          <Empty>{t("patients.empty")}</Empty>
        ) : (
          <Table head={head}>
            {page.items.map((patient) => (
              <tr key={patient.id} className="hover:bg-slate-50">
                <Td className="font-medium">
                  {patient.given_names} {patient.family_names}
                  {/* A minor's appointments are arranged with a guardian, so
                      it changes who the clinic contacts. Worth showing. */}
                  {patient.is_minor ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {t("patients.minor")}
                    </span>
                  ) : null}
                </Td>
                {/* Identifiers arrive masked from the API and there is no route
                    that unmasks them: they are encrypted at rest. */}
                <Td className="font-mono text-xs text-slate-600">
                  {patient.document_type} {patient.document_number_masked}
                </Td>
                <Td className="tabular-nums text-slate-600">{patient.age ?? "—"}</Td>
                <Td className="font-mono text-xs text-slate-600">{patient.phone_masked ?? "—"}</Td>
                <Td className="text-slate-600">{patient.email_masked ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
