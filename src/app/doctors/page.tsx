import { listDoctors } from "@/lib/api";
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



export default async function DoctorsPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const head = [
    t("doctors.col.doctor"),
    t("doctors.col.specialty"),
    t("doctors.col.status"),
  ];
  const result = await load("doctors", (clinic) =>
    listDoctors(clinic.id, { limit: 100 }),
  );
  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;

  return (
    <>
      <PageHeading
        title={t("doctors.title")}
        subtitle={`${page.total.toLocaleString(intlLocale(locale))} ${t("appointments.total")}`}
      />

      <Card>
        {page.items.length === 0 ? (
          <Empty>{t("doctors.empty")}</Empty>
        ) : (
          <Table head={head}>
            {page.items.map((doctor) => (
              <tr key={doctor.id} className="hover:bg-slate-50">
                <Td className="font-medium">{doctor.full_name}</Td>
                <Td className="text-slate-600">{doctor.specialty || "—"}</Td>
                <Td>
                  {/* An inactive doctor keeps their history but takes no new
                      appointments, so the distinction matters on this screen. */}
                  <span
                    className={
                      doctor.active
                        ? "inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200"
                        : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200"
                    }
                  >
                    {doctor.active ? t("doctors.active") : t("doctors.inactive")}
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
