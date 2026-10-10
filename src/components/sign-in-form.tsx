"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
/** The words this form shows. Resolved on the server: a function cannot cross
 *  into a client component, because React serialises data rather than closures. */
export interface SignInLabels {
  password: string;
  submit: string;
  submitting: string;
}

/**
 * The sign-in form.
 *
 * A failure is a toast rather than inline text, deliberately: the only thing
 * that can be wrong is the password, the field is still on screen, and an
 * inline error under a single input is a line nobody reads before retyping.
 */
export function SignInForm({
  action,
  labels,
}: {
  action: (form: FormData) => Promise<{ ok: boolean; message: string }>;
  labels: SignInLabels;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");

  return (
    <form
      action={(form) =>
        start(async () => {
          const result = await action(form);
          if (result.ok) {
            toast.success(result.message, {
              icon: <ShieldCheck className="size-4" />,
            });
            setValue("");
            // The layout renders the role, so the whole tree has to re-render.
            router.refresh();
            router.push("/patients");
          } else {
            toast.error(result.message);
          }
        })
      }
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending || value === ""} className="w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {labels.submitting}
          </>
        ) : (
          labels.submit
        )}
      </Button>
    </form>
  );
}
