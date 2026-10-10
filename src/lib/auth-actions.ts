"use server";

/**
 * Sign in and out.
 *
 * The password is posted to a Server Action rather than to the API from the
 * browser, for the same reason every other write goes this way: the API is not
 * reachable from a page. It also means the password never appears in a URL or
 * in the browser's network log against a cross-origin request.
 *
 * The API's `Set-Cookie` is passed through rather than reconstructed. It
 * decides the name, the lifetime and the flags; copying those here would mean
 * two places disagreeing about a security boundary the first time one changes.
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { signInUpstream } from "@/lib/api";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { translator, type Locale } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";

export type AuthResult = { ok: boolean; message: string };

/** Pull one cookie's value out of a `Set-Cookie` header. */
function cookieValue(setCookie: string, name: string): string | null {
  const match = new RegExp(`(?:^|,\s*)${name}=([^;]*)`).exec(setCookie);
  return match ? match[1] : null;
}

export async function signIn(form: FormData): Promise<AuthResult> {
  const locale: Locale = await currentLocale();
  const t = translator(locale);
  const password = form.get("password");

  if (typeof password !== "string" || password === "") {
    return { ok: false, message: t("auth.wrongPassword") };
  }

  try {
    const upstream = await signInUpstream(password);
    if (!upstream.ok) {
      return { ok: false, message: t("auth.wrongPassword") };
    }

    const token = upstream.setCookie
      ? cookieValue(upstream.setCookie, SESSION_COOKIE_NAME)
      : null;
    if (!token) {
      // The API said yes but sent no cookie, which it should never do. Failing
      // here rather than reporting success keeps the screen honest: without the
      // cookie the next request is staff again.
      console.error("[auth] sign-in succeeded with no session cookie");
      return { ok: false, message: t("auth.notConfigured") };
    }

    (await cookies()).set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Mirrors the API's own reasoning: a `secure` cookie is never stored
      // over http on loopback, which would look like a broken login.
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/", "layout");
    return { ok: true, message: t("auth.signedIn") };
  } catch (error) {
    console.error(`[auth] ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, message: t("error.title") };
  }
}

export async function signOut(): Promise<AuthResult> {
  const t = translator(await currentLocale());
  (await cookies()).delete(SESSION_COOKIE_NAME);
  revalidatePath("/", "layout");
  return { ok: true, message: t("auth.signedOut") };
}
