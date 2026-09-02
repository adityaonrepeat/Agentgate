import { cookies } from "next/headers";
import { getSession } from "./db";
import type { Actor } from "./types";

export const SESSION_COOKIE = "agentgate_session";

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>([new URL(request.url).origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) origins.add(new URL(configured).origin);

  return origins;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(request).has(origin))
    throw new Error("Cross-origin mutation blocked.");
}

export async function getCurrentActor(): Promise<Actor | null> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;

  return sid ? getSession(sid) : null;
}

export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new Error("Sign in is required.");

  return actor;
}

export async function requireMutationActor(request: Request): Promise<Actor> {
  assertSameOrigin(request);

  return requireActor();
}
