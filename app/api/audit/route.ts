import { NextResponse } from "next/server";
import { requireActor } from "@/lib/actor";
import { client, ensureSchema } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireActor();
    await ensureSchema();
    const result = await client.execute(
      "SELECT id,action_request_id,approval_id,actor_type,actor_id,actor_display,event,reason_code,changed_fields,payload_hash,created_at FROM audit_events ORDER BY created_at DESC",
    );
    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to read audit log.";
    return NextResponse.json(
      { error: message },
      { status: message === "Sign in is required." ? 401 : 400 },
    );
  }
}
