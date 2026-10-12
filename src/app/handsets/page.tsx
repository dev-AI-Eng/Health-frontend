import Link from "next/link";
import { Info, Lock, PhoneCall, Users } from "lucide-react";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSharedHandsets } from "@/lib/api-import";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";

/** Rendered per request: bindings change as patients are imported. */
export const dynamic = "force-dynamic";

/**
 * Phones with more than one patient on them.
 *
 * A household handset, or a carer's. It matters because a reminder sent there
 * is read by whoever answers, so M4's dispatch gate has to consult this before
 * sending — and staff should know which numbers these are before then.
 *
 * Administrator-only, like the audit log: a row here names several patients
 * together, which is more than a single patient's own record discloses.
 */
export default async function HandsetsPage() {
  const [locale, role] = await Promise.all([currentLocale(), currentRole()]);
  const t = translator(locale);

  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeading title={t("handsets.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
              <Lock className="size-5" />
            </span>
            <p className="text-muted-foreground max-w-sm text-sm">
              {t("handsets.adminOnly")}
            </p>
            <Button asChild>
              <Link href="/sign-in">{t("auth.signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await load("handsets", (clinic) => listSharedHandsets(clinic.id));

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const handsets = result.data;

  return (
    <>
      <PageHeading title={t("handsets.title")} subtitle={t("handsets.subtitle")} />

      {handsets.length === 0 ? (
        <Card className="py-0">
          <Empty icon={<PhoneCall className="size-5" />}>{t("handsets.none")}</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {handsets.map((handset) => (
            <Card key={handset.reference}>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="status-held ring-1 ring-inset">
                    <Users className="mr-1 size-3" />
                    {handset.patient_count} {t("handsets.patients")}
                  </Badge>
                  {/* Not the number: it is encrypted at rest and this route
                      never returns it. The reference only groups the rows. */}
                  <span className="text-muted-foreground font-mono text-xs">
                    {t("handsets.reference")} {handset.reference}
                  </span>
                </div>

                <ul className="divide-border divide-y">
                  {handset.members.map((member) => (
                    <li
                      key={member.patient_id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
                    >
                      <Link
                        href={`/patients/${member.patient_id}`}
                        className="hover:text-primary font-medium underline-offset-4 transition-colors hover:underline"
                      >
                        {member.patient_name}
                      </Link>
                      <Badge variant="secondary">{member.relationship_kind}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t("handsets.referenceHint")}
      </p>
    </>
  );
}
