import { z } from "zod";
import { NextResponse } from "next/server";
import { requireMutationActor } from "@/lib/actor";
import { ensureSchema, SqlApprovalStore } from "@/lib/db";
import { executeAction } from "@/lib/gate";

const bodySchema = z.object({ approvalId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await requireMutationActor(request);
    const { id } = await context.params;
    const body = bodySchema.parse((await request.json()) as unknown);
    await ensureSchema();
    const result = await executeAction(new SqlApprovalStore(), {
      actionRequestId: id,
      approvalId: body.approvalId,
      actor,
    });
    return NextResponse.json(result, { status: result.outcome === "allowed" ? 200 : 409 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Execution failed.";
    return NextResponse.json(
      { error: message },
      { status: message === "Sign in is required." ? 401 : 400 },
    );
  }
}
