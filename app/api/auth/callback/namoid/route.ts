import { NextResponse } from "next/server";
import { createSession } from "@/lib/db";
import { namoid, namoidConfigured } from "@/lib/namoid";
import { SESSION_COOKIE } from "@/lib/actor";

function identityName(identity: {
  name?: string | null;
  email?: string | null;
  sub: string;
}): string {
  return identity.name?.trim() || identity.email?.trim() || identity.sub;
}

export async function GET(request: Request): Promise<Response> {
  if (!namoidConfigured())
    return NextResponse.redirect(new URL("/login?error=not-configured", request.url));

  return namoid().callback(request, {
    onSuccess: async ({ identity }) => {
      const sid = await createSession({
        sub: identity.sub,
        name: identityName(identity),
        email: identity.email ?? "",
      });
      const response = NextResponse.redirect(new URL("/inbox", request.url));
      response.cookies.set(SESSION_COOKIE, sid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 60 * 60,
      });
      return response;
    },

    onError: async () => NextResponse.redirect(new URL("/login?error=callback", request.url)),
  });
}
