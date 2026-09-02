import { z } from "zod";
import { NextResponse } from "next/server";
import { decideAction } from "@/lib/approval";
import { requireMutationActor } from "@/lib/actor";

const decisionBody = z.object({ decision: z.enum(["approve", "reject"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await requireMutationActor(request);
    const { id } = await context.params;
    const input = decisionBody.parse((await request.json()) as unknown);
    return NextResponse.json(await decideAction(id, input.decision, actor));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Decision failed.";
    return NextResponse.json(
      { error: message },
      { status: message === "Sign in is required." ? 401 : 400 },
    );
  }
}
