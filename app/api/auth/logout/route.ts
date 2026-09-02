import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/actor";
import { client } from "@/lib/db";
import { namoid, namoidConfigured } from "@/lib/namoid";

export async function POST(request: Request): Promise<Response> {
  const sid = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (sid) await client.execute({ sql: "DELETE FROM sessions WHERE sid = ?", args: [sid] });
  if (namoidConfigured()) {
    const response = await namoid().logout({ clearHostedSession: true });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    return response;
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);

  return response;
}
