import { Info } from "lucide-react";

import { ConversationSimulator } from "@/components/conversation";
import { ApiFailure, PageHeading } from "@/components/page";
import { simulateTurn } from "@/lib/actions";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: each turn reads live appointment state. */
export const dynamic = "force-dynamic";

/**
 * M3's conversation prototype (Rev3: "full conversation flow demo").
 *
 * Rev3 says the pipeline is "validated on a lightweight chatbot testing
 * platform". This is that, built here rather than on a third party: no signup,
 * and — the deciding reason — no conversation data leaving the machine, which
 * a hosted bot tester would require while rule 7 forbids it.
 *
 * The screen deliberately shows more than a chat window would. A reply alone
 * proves the pipeline emits Spanish; M3's exit criteria are about the gate, so
 * the drafts, the findings and the verified facts are on screen too.
 */
export default async function ConversationPage() {
  const locale = await currentLocale();
  const t = translator(locale);

  // Only to find a seeded number worth pre-filling, so a reviewer's first
  // turn resolves to a patient instead of reporting an unknown sender.
  const result = await load("conversation", async (clinic) => clinic);

  if (!result.ok) {
    return <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />;
  }

  return (
    <>
      <PageHeading title={t("chat.title")} subtitle={t("chat.subtitle")} />

      <ConversationSimulator
        action={simulateTurn}
        defaultPhone="+573989245874"
        labels={{
          phone: t("chat.phone"),
          phoneHint: t("chat.phoneHint"),
          message: t("chat.message"),
          send: t("chat.send"),
          sending: t("chat.sending"),
          patient: t("chat.patient"),
          intent: t("chat.intent"),
          stop: t("chat.stop"),
          attempts: t("chat.attempts"),
          drafts: t("chat.drafts"),
          draftsHint: t("chat.draftsHint"),
          approved: t("chat.approved"),
          refused: t("chat.refused"),
          templated: t("chat.templated"),
          generated: t("chat.generated"),
          facts: t("chat.facts"),
          factsHint: t("chat.factsHint"),
          noFacts: t("chat.noFacts"),
          escalated: t("chat.escalated"),
          nothingSent: t("chat.nothingSent"),
          examples: t("chat.examples"),
          noPatient: t("chat.noPatient"),
          resolved: t("chat.resolved"),
        }}
      />

      <p className="text-muted-foreground mt-6 flex items-start gap-2 text-sm">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t("chat.subtitle")}
      </p>
    </>
  );
}
