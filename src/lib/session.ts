import "server-only";

import { cookies, headers } from "next/headers";

import { readSession, type Role } from "@/lib/api";

/**
 * The role this request is rendering for.
 *
 * Asked of the API rather than decided here. The cookie is signed with a key
 * this process does not hold, so the only honest answer comes from the service
 * that can verify it — and a frontend that decided its own role would be a
 * frontend an attacker only has to lie to.
 *
 * Falls back to `staff`, which every screen renders correctly.
 */
export async function currentRole(): Promise<Role> {
  const header = (await headers()).get("cookie") ?? undefined;
  const session = await readSession(header);
  return session.role;
}

/** The raw cookie header, for an action that has to forward it. */
export async function cookieHeader(): Promise<string | undefined> {
  const jar = await cookies();
  const all = jar.getAll();
  if (all.length === 0) return undefined;
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}
