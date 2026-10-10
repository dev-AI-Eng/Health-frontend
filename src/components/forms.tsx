"use client";

/**
 * The interactive pieces: forms and buttons that call a Server Action.
 *
 * These are the only client components. Everything else renders on the server,
 * so patient data reaches the browser only as the fields a page chose to show.
 *
 * NO BROWSER DIALOGS
 * ------------------
 * No `alert` and no `confirm`. Both block the page, cannot be styled, print
 * "localhost:3000 says" above the message, and on a reception desk two of them
 * queue behind each other with no indication of which belongs to what.
 *
 * Outcomes arrive as a toast, mounted once in the layout. A destructive action
 * asks in a dialog that names the patient, because "Cancel this appointment?"
 * with no name is a question nobody can answer safely with a queue in front of
 * them.
 */

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/actions";

type Action = (form: FormData) => Promise<ActionResult>;

/**
 * Show an action's outcome.
 *
 * A refusal is a warning rather than an error: "that time is taken" is the
 * system working, and a red banner would teach staff to distrust the screen.
 * The request id goes in the description, where it can be read out over the
 * phone without dominating the message.
 */
function report(result: ActionResult) {
  if (result.ok) {
    toast.success(result.message, { icon: <Check className="size-4" /> });
    return;
  }
  toast.warning(result.message, {
    description: result.requestId ? `ref: ${result.requestId}` : undefined,
  });
}

/** A plain action button: one click, one outcome. */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "outline",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() => {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.set(key, value);
        start(async () => report(await action(form)));
      }}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/**
 * An action that asks first, in a dialog that names what it will affect.
 *
 * Replaces `window.confirm`. The difference that matters is not the styling:
 * it is that this can show the patient's name and the appointment time, so the
 * person clicking knows which of twelve rows they are about to change.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  pendingLabel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant={destructive ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={destructive ? "text-destructive hover:text-destructive" : undefined}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                const form = new FormData();
                for (const [key, value] of Object.entries(fields)) form.set(key, value);
                start(async () => {
                  report(await action(form));
                  setOpen(false);
                });
              }}
            >
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {pendingLabel}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The words a reschedule dialog shows. Passed in: the copy lives on the server. */
export interface WhenLabels {
  trigger: string;
  title: string;
  description: string;
  date: string;
  time: string;
  submit: string;
  submitting: string;
  cancel: string;
}

/**
 * Move an appointment to a new time.
 *
 * A dialog rather than a row that expands. The previous version put date and
 * time inputs inside a table cell, which made the row three lines tall and the
 * whole table jump when it opened.
 *
 * Native `date` and `time` inputs rather than a picker library: the browser's
 * own controls already speak the user's locale, handle the keyboard, and work
 * on a phone.
 */
export function RescheduleDialog({
  action,
  appointmentId,
  durationMinutes,
  defaultDate,
  defaultTime,
  labels,
}: {
  action: Action;
  appointmentId: string;
  durationMinutes: number;
  defaultDate: string;
  defaultTime: string;
  labels: WhenLabels;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {labels.trigger}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <form
            action={(form) =>
              start(async () => {
                const result = await action(form);
                report(result);
                if (result.ok) setOpen(false);
              })
            }
            className="grid gap-4"
          >
            <input type="hidden" name="appointment_id" value={appointmentId} />
            <input type="hidden" name="duration_minutes" value={durationMinutes} />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`date-${appointmentId}`}>{labels.date}</Label>
                <Input
                  id={`date-${appointmentId}`}
                  type="date"
                  name="date"
                  required
                  defaultValue={defaultDate}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`time-${appointmentId}`}>{labels.time}</Label>
                <Input
                  id={`time-${appointmentId}`}
                  type="time"
                  name="time"
                  required
                  step={300}
                  defaultValue={defaultTime}
                  disabled={pending}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {labels.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {labels.submitting}
                  </>
                ) : (
                  labels.submit
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One option in a picker. */
export interface Choice {
  id: string;
  label: string;
  hint?: string;
}

/** The words the booking form shows. */
export interface BookingLabels {
  patient: string;
  doctor: string;
  site: string;
  type: string;
  date: string;
  time: string;
  select: string;
  minutes: string;
  submit: string;
  submitting: string;
}

/**
 * The new-appointment form.
 *
 * Duration follows the appointment type rather than being typed: how long a
 * consultation takes is the clinic's decision, and letting a receptionist set
 * it is how a 20-minute appointment lands in a 10-minute slot.
 *
 * Cleared on success so the next patient can be booked straight away, which is
 * what somebody working through a queue of calls actually does.
 */
export function BookingForm({
  action,
  patients,
  doctors,
  locations,
  types,
  defaultDate,
  labels,
}: {
  action: Action;
  patients: Choice[];
  doctors: Choice[];
  locations: Choice[];
  types: (Choice & { durationMinutes: number })[];
  defaultDate: string;
  labels: BookingLabels;
}) {
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  // Bumped on success to remount the date and time inputs, which resets them
  // without making the whole form controlled.
  const [generation, setGeneration] = useState(0);

  const duration =
    types.find((type) => type.id === typeId)?.durationMinutes ??
    types[0]?.durationMinutes ??
    20;

  const ready = patientId !== "" && doctorId !== "" && locationId !== "" && typeId !== "";

  return (
    <form
      action={(form) =>
        start(async () => {
          const result = await action(form);
          report(result);
          if (result.ok) {
            setPatientId("");
            setGeneration((n) => n + 1);
          }
        })
      }
      className="grid gap-5"
    >
      {/* The Select components are controlled, so their values travel in hidden
          inputs: a Radix select is a button and a listbox, not a native one. */}
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="doctor_id" value={doctorId} />
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="appointment_type_id" value={typeId} />
      <input type="hidden" name="duration_minutes" value={duration} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="patient">{labels.patient}</Label>
          <Select value={patientId} onValueChange={setPatientId} disabled={pending}>
            <SelectTrigger id="patient" className="w-full">
              <SelectValue placeholder={labels.select} />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span>{p.label}</span>
                  {p.hint ? (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {p.hint}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="doctor">{labels.doctor}</Label>
          <Select value={doctorId} onValueChange={setDoctorId} disabled={pending}>
            <SelectTrigger id="doctor" className="w-full">
              <SelectValue placeholder={labels.select} />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span>{d.label}</span>
                  {d.hint ? (
                    <span className="text-muted-foreground ml-2 text-xs">{d.hint}</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="site">{labels.site}</Label>
          <Select value={locationId} onValueChange={setLocationId} disabled={pending}>
            <SelectTrigger id="site" className="w-full">
              <SelectValue placeholder={labels.select} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="appointment-type">{labels.type}</Label>
          <Select value={typeId} onValueChange={setTypeId} disabled={pending}>
            <SelectTrigger id="appointment-type" className="w-full">
              <SelectValue placeholder={labels.select} />
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {type.durationMinutes} {labels.minutes}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="date">{labels.date}</Label>
          <Input
            key={`date-${generation}`}
            id="date"
            type="date"
            name="date"
            required
            defaultValue={defaultDate}
            disabled={pending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="time">{labels.time}</Label>
          <Input
            key={`time-${generation}`}
            id="time"
            type="time"
            name="time"
            required
            step={300}
            defaultValue="09:00"
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !ready}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {labels.submitting}
            </>
          ) : (
            <>
              <CalendarPlus className="size-4" />
              {labels.submit}
            </>
          )}
        </Button>
        <span className="text-muted-foreground text-sm">
          {duration} {labels.minutes}
        </span>
      </div>
    </form>
  );
}
