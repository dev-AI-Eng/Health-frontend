import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { SignInForm } from "@/components/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "@/lib/auth-actions";
import { translator } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the copy follows the chosen language. */
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const t = translator(await currentLocale());

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <div className="bg-accent text-accent-foreground mb-2 grid size-10 place-items-center rounded-lg">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>{t("auth.title")}</CardTitle>
          {/* Says what the role gives and what it costs. Somebody signing in
              should know the view is recorded before they see it, not after. */}
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm
            action={signIn}
            labels={{
              password: t("auth.password"),
              submit: t("auth.submit"),
              submitting: t("auth.submitting"),
            }}
          />
        </CardContent>
      </Card>

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("auth.backToDashboard")}
      </Link>
    </div>
  );
}
