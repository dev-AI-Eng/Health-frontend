"use client";

/**
 * The slot finder: what a doctor can actually offer, computed on demand.
 *
 * This is the screen that makes M2's availability decision visible. A reviewer
 * can set a date range and a window the patient can attend, press search, and
 * watch the engine exclude a public holiday, a morning the doctor took off,
 * and the times already in their diary — rather than reading that it does.
 *
 * It also makes the fallback visible: narrow the hours past what the doctor
 * works and the answer is an empty list with a sentence saying that this is
 * what gets escalated to a person. That is M2's second exit criterion, and
 * nowhere else in the dashboard shows it happening.
 */

import { useState, useTransition } from "react";
import { CalendarSearch, Clock, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Slot } from "@/lib/api-import";

export interface SlotFinderLabels {
  from: string;
  to: string;
  type: string;
  earliest: string;
  latest: string;
  search: string;
  searching: string;
  found: string;
  none: string;
  anyHour: string;
}

export interface TypeChoice {
  id: string;
  name: string;
  durationMinutes: number;
}

export function SlotFinder({
  action,
  doctorId,
  types,
  defaultFrom,
  defaultTo,
  labels,
  minutesLabel,
}: {
  action: (form: FormData) => Promise<
    { ok: true; slots: Slot[] } | { ok: false; message: string }
  >;
  /** Fixed by the page this sits on, so it travels hidden rather than as a picker. */
  doctorId: string;
  types: TypeChoice[];
  defaultFrom: string;
  defaultTo: string;
  labels: SlotFinderLabels;
  minutesLabel: string;
}) {
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [slots, setSlots] = useState<Slot[] | null>(null);

  const when = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });

  return (
    <Card>
      <CardContent className="space-y-5">
        <form
          action={(form) =>
            start(async () => {
              const result = await action(form);
              if (result.ok) {
                setSlots(result.slots);
              } else {
                toast.warning(result.message);
                setSlots(null);
              }
            })
          }
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input type="hidden" name="doctor_id" value={doctorId} />
          <input type="hidden" name="appointment_type_id" value={typeId} />

          <div className="grid gap-2">
            <Label htmlFor="type">{labels.type}</Label>
            <Select value={typeId} onValueChange={setTypeId} disabled={pending}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {type.durationMinutes} {minutesLabel}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="start_date">{labels.from}</Label>
            <Input
              id="start_date"
              type="date"
              name="start_date"
              required
              defaultValue={defaultFrom}
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="end_date">{labels.to}</Label>
            <Input
              id="end_date"
              type="date"
              name="end_date"
              required
              defaultValue={defaultTo}
              disabled={pending}
            />
          </div>

          {/* The window the patient can attend. "Afternoons only" against a
              doctor who works mornings is exactly what produces the fallback,
              and leaving these blank means no constraint at all. */}
          <div className="grid gap-2">
            <Label htmlFor="earliest">{labels.earliest}</Label>
            <Input
              id="earliest"
              type="time"
              name="earliest"
              step={900}
              placeholder={labels.anyHour}
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="latest">{labels.latest}</Label>
            <Input
              id="latest"
              type="time"
              name="latest"
              step={900}
              placeholder={labels.anyHour}
              disabled={pending}
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={pending || typeId === ""} className="w-full">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {labels.searching}
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  {labels.search}
                </>
              )}
            </Button>
          </div>
        </form>

        {slots !== null ? (
          slots.length === 0 ? (
            /* The fallback, visible. Not an error: "no appointment is
               available" is an answer, and this says what happens next. */
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="flex items-start gap-2 text-sm">
                <CalendarSearch className="mt-0.5 size-4 shrink-0" />
                {labels.none}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground mb-3 text-sm">
                {slots.length} {labels.found}
              </p>
              {/* Named for the e2e test. Asserting on the visible phrase
                  instead matched the prose above it and even an SVG path
                  ending in digits, so the test passed on a doctor with no
                  availability at all. A computed slot is a list item here. */}
              <ul
                data-testid="computed-slots"
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                {slots.map((slot) => (
                  <li
                    key={slot.start}
                    className="bg-muted/40 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <Clock className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="font-medium">{when.format(new Date(slot.start))}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {slot.duration_minutes} {minutesLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
