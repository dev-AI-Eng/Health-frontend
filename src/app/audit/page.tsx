import Link from "next/link";
import { Suspense } from "react";
import { FileCheck2, Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLog, verifyAuditChain, type ChainVerification } from "@/lib/api-import";
import { intlLocale, translator, type CopyKey, type Locale, type T } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";
import { currentRole } from "@/lib/session";

/** Rendered per request: the log grows with every patient-data access. */
export const dynamic = "force-dynamic";

const ACTIONS = ["read", "create", "update", "delete", "disclose"] as const;

function actionLabel(action: string, t: T): string {
  return (ACTIONS as readonly string[]).includes(action)
    ? t(`audit.action.${action}` as CopyKey)
    : action;
}

/** A disclosure stands out: it is the one that revealed real identifiers. */
function actionTone(action: string): string {
  if (action === "disclose") return "status-no-show";
  if (action === "delete") return "status-cancelled";
  if (action === "create") return "status-confirmed";
  if (action === "update") return "status-rescheduled";
  return "status-scheduled";
}


/** While the chain is being walked. Says what is happening, not just a spinner. */
function ChainPending({ label }: { label: string }) {
  return (
    <Card className="bg-muted/40 mb-6">
      <CardContent className="flex items-center gap-3 py-1">
        <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
        <p className="text-muted-foreground text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The integrity guarantee, verified rather than asserted in a document.
 *
 * Altering or deleting an entry breaks the chain, and this is the result of
 * actually checking every row just now. Its own component so it can stream:
 * the check is O(n) over the log and the entries beside it are not.
 */
async function ChainStatus({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const nf = new Intl.NumberFormat(intlLocale(locale));

  let chain: ChainVerification;
  try {
    chain = await verifyAuditChain();
  } catch {
    // A failed check is not a broken chain, and must not be shown as one.
    return (
      <Card className="bg-muted/40 mb-6">
        <CardContent className="flex items-center gap-3 py-1">
          <ShieldAlert className="text-muted-foreground size-4 shrink-0" />
          <p className="text-muted-foreground text-sm">{t("audit.verifyFailed")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "mb-6",
        chain.intact
          ? "border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/25"
          : "border-destructive/40 bg-destructive/5",
      )}
    >
      <CardContent className="flex items-start gap-3 py-1">
        {chain.intact ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300" />
        ) : (
          <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
        )}
        <div className="min-w-0 text-sm">
          <span className="font-medium">
            {chain.intact ? t("audit.chainIntact") : t("audit.chainBroken")}
          </span>{" "}
          <span className="text-muted-foreground">
            {nf.format(chain.rows_checked)} {t("audit.rowsChecked")} · {t("audit.chainHint")}
          </span>
          {chain.first_broken_id !== null ? (
            <p className="text-destructive mt-1 font-mono text-xs">
              {t("audit.brokenAt")}: #{chain.first_broken_id}
            </p>
          ) : null}
          {chain.truncated_after_id !== null ? (
            <p className="text-destructive mt-1 font-mono text-xs">
              {t("audit.truncatedAfter")}: #{chain.truncated_after_id}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AuditPage() {
  const [locale, role] = await Promise.all([currentLocale(), currentRole()]);
  const t = translator(locale);

  // The log names patients, so it is an administrator's screen. Refused here
  // with an explanation rather than hidden: a receptionist who follows a link
  // should learn why, not meet a blank page.
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeading title={t("audit.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
              <Lock className="size-5" />
            </span>
            <p className="text-muted-foreground max-w-sm text-sm">{t("audit.adminOnly")}</p>
            <Button asChild>
              <Link href="/sign-in">{t("auth.signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The entries and the verification are fetched separately on purpose. The
  // check walks the entire log -- that is what makes it a verification rather
  // than a sample -- so it takes about ten seconds at 56,000 entries and grows
  // with the log. Awaiting both would hold the whole page behind the slow one.
  const result = await load("audit", () => listAuditLog({ limit: 100 }));

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }
  const page = result.data;
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  });

  return (
    <>
      <PageHeading
        title={t("audit.title")}
        subtitle={`${nf.format(page.total)} ${t("appointments.total")}`}
      />

      {/* Streamed: the log renders at once and the verification arrives when
          it finishes, rather than the page waiting ten seconds for it. */}
      <Suspense fallback={<ChainPending label={t("audit.verifying")} />}>
        <ChainStatus locale={locale} />
      </Suspense>

      <Card className="overflow-hidden py-0">
        {page.items.length === 0 ? (
          <Empty icon={<FileCheck2 className="size-5" />}>{t("audit.empty")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("audit.col.when")}</TableHead>
                  <TableHead>{t("audit.col.action")}</TableHead>
                  <TableHead>{t("audit.col.what")}</TableHead>
                  <TableHead>{t("audit.col.who")}</TableHead>
                  <TableHead>{t("audit.col.why")}</TableHead>
                  <TableHead>{t("audit.col.fields")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {when.format(new Date(entry.occurred_at))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("ring-1 ring-inset", actionTone(entry.action))}
                      >
                        {actionLabel(entry.action, t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.resource}
                      {entry.patient_id ? (
                        <span className="text-muted-foreground ml-1.5 font-mono text-xs">
                          {entry.patient_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.actor_id ?? entry.actor_kind}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {entry.purpose}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.fields_disclosed && entry.fields_disclosed.length > 0 ? (
                        <span className="text-rose-700 dark:text-rose-300">
                          {entry.fields_disclosed.join(", ")}
                        </span>
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

      <p className="text-muted-foreground mt-4 text-sm">{t("audit.discloseHint")}</p>
    </>
  );
}
