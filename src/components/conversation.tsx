"use client";

/**
 * The M3 conversation simulator.
 *
 * Rev3 asks for the conversation flow "validated on a lightweight chatbot
 * testing platform". This is that surface, inside the dashboard rather than a
 * third-party tool: no signup, no conversation data leaving the machine, and
 * it reuses the auth and clinic scope already here.
 *
 * It is a **review** surface, not a chat window. A chat window would show the
 * reply and prove only that the pipeline produces Spanish. What a reviewer has
 * to see is the gate working: which intent was read, every draft attempt, what
 * the gate refused and why, and the verified facts the reply was allowed to
 * draw on. Those are M3's exit criteria, and they are invisible otherwise.
 */

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Send, ShieldCheck, ShieldX, User, UserX } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConversationTurn } from "@/lib/api-import";
import type { ActionResult } from "@/lib/actions";

export interface ChatLabels {
  phone: string;
  phoneHint: string;
  message: string;
  send: string;
  sending: string;
  patient: string;
  intent: string;
  stop: string;
  attempts: string;
  drafts: string;
  draftsHint: string;
  approved: string;
  refused: string;
  templated: string;
  generated: string;
  facts: string;
  factsHint: string;
  noFacts: string;
  escalated: string;
  nothingSent: string;
  examples: string;
  noPatient: string;
  resolved: string;
}

/** Messages a reviewer is likely to want to try, in the Spanish a patient writes. */
const EXAMPLES: readonly string[] = [
  "Si, confirmo",
  "No puedo ir, cancelar",
  "Quiero otra fecha",
  "Me duele mucho el estómago",
  "Quiero hablar con alguien",
  "No quiero más mensajes",
];

type Outcome = { turn: ConversationTurn } | { error: string } | null;

export function ConversationSimulator({
  action,
  labels,
  defaultPhone,
}: {
  action: (form: FormData) => Promise<ActionResult & { turn?: ConversationTurn }>;
  labels: ChatLabels;
  defaultPhone: string;
}) {
  const [text, setText] = useState("Si, confirmo");
  const [phone, setPhone] = useState(defaultPhone);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const result = await action(formData);
      setOutcome(result.ok && result.turn ? { turn: result.turn } : { error: result.message });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardContent>
          <form action={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sender_phone">{labels.phone}</Label>
              <Input
                id="sender_phone"
                name="sender_phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="font-mono text-sm"
                disabled={pending}
                required
              />
              <p className="text-muted-foreground text-xs">{labels.phoneHint}</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="text">{labels.message}</Label>
              <textarea
                id="text"
                name="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                disabled={pending}
                className="border-input bg-background focus-visible:ring-ring min-h-20 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              />
            </div>

            <Button type="submit" disabled={pending}>
              <Send className="size-3.5" />
              {pending ? labels.sending : labels.send}
            </Button>
          </form>

          <div className="mt-5">
            <p className="text-muted-foreground mb-2 text-xs font-medium">{labels.examples}</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={pending}
                  onClick={() => setText(example)}
                  className="hover:bg-accent rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0">
        {outcome === null ? null : "error" in outcome ? (
          <Card>
            <CardContent className="flex items-start gap-2 py-5 text-sm">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
              {outcome.error}
            </CardContent>
          </Card>
        ) : (
          <TurnReport turn={outcome.turn} labels={labels} />
        )}
      </div>
    </div>
  );
}

function TurnReport({ turn, labels }: { turn: ConversationTurn; labels: ChatLabels }) {
  return (
    <div className="grid gap-4">
      {/* What the patient receives, first and largest: it is the thing that
          actually leaves the machine. */}
      <Card>
        <CardContent className="py-5">
          {turn.outbound_text ? (
            <div className="bg-accent/40 rounded-xl rounded-tl-sm border px-4 py-3">
              <p className="text-sm whitespace-pre-line">{turn.outbound_text}</p>
            </div>
          ) : (
            <p className="text-destructive flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {labels.nothingSent}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {labels.intent}: {turn.intent}
            </Badge>
            {turn.stop ? (
              <Badge className="status-held ring-1 ring-inset font-mono text-xs">
                {labels.stop}: {turn.stop}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-xs">
              {labels.attempts}: {turn.attempts}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "ring-1 ring-inset text-xs",
                turn.patient_resolved ? "status-completed" : "status-no-show",
              )}
            >
              {turn.patient_resolved ? (
                <User className="mr-1 size-3" />
              ) : (
                <UserX className="mr-1 size-3" />
              )}
              {turn.patient_resolved ? labels.resolved : labels.noPatient}
            </Badge>
            {turn.escalation_id ? (
              <Badge className="status-held ring-1 ring-inset text-xs">{labels.escalated}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* The gate. A reviewer counts drafts here to see the retry bound hold,
          and reads the findings to see what was caught. */}
      {turn.drafts.length > 0 ? (
        <Card>
          <CardContent className="py-5">
            <h3 className="text-sm font-semibold">{labels.drafts}</h3>
            <p className="text-muted-foreground mt-1 mb-3 text-xs">{labels.draftsHint}</p>
            <ol className="grid gap-2.5">
              {turn.drafts.map((draft, index) => (
                <li
                  key={index}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    draft.approved
                      ? "border-emerald-300/70 dark:border-emerald-900/70"
                      : "border-amber-300/70 dark:border-amber-900/70",
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs tabular-nums">
                      #{index + 1}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ring-1 ring-inset text-xs",
                        draft.approved ? "status-completed" : "status-no-show",
                      )}
                    >
                      {draft.approved ? (
                        <ShieldCheck className="mr-1 size-3" />
                      ) : (
                        <ShieldX className="mr-1 size-3" />
                      )}
                      {draft.approved ? labels.approved : labels.refused}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {draft.templated ? labels.templated : labels.generated}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-xs">{draft.kind}</span>
                  </div>
                  <p className="text-sm whitespace-pre-line">{draft.text}</p>
                  {draft.findings.length > 0 ? (
                    <ul className="mt-2 grid gap-1">
                      {draft.findings.map((finding, position) => (
                        <li key={position} className="text-xs">
                          <span className="font-mono font-medium">{finding.reason}</span>
                          {finding.span ? (
                            <>
                              {" — "}
                              <code className="bg-muted rounded px-1">{finding.span}</code>
                            </>
                          ) : null}
                          {finding.detail ? (
                            <span className="text-muted-foreground"> · {finding.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* Rule 4 made visible: the message may state these and nothing else. */}
      <Card>
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold">{labels.facts}</h3>
          <p className="text-muted-foreground mt-1 mb-3 text-xs">{labels.factsHint}</p>
          {Object.keys(turn.verified_facts).length === 0 ? (
            <p className="text-muted-foreground text-sm">{labels.noFacts}</p>
          ) : (
            <dl className="grid gap-1.5 sm:grid-cols-2">
              {Object.entries(turn.verified_facts).map(([key, value]) => (
                <div key={key} className="flex flex-wrap items-baseline gap-1.5 text-xs">
                  <dt className="text-muted-foreground font-mono">{key}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {turn.reason_codes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {turn.reason_codes.map((code) => (
                <Badge key={code} variant="outline" className="font-mono text-xs">
                  <Check className="mr-1 size-3" />
                  {code}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
