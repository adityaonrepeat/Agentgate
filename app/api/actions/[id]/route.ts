import { NextResponse } from "next/server";
import { editAction } from "@/lib/approval";
import { requireMutationActor } from "@/lib/actor";

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status =
    message === "Sign in is required." ? 401 : message === "Action request not found." ? 404 : 400;

  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await requireMutationActor(request);
    const { id } = await context.params;
    const body = (await request.json()) as unknown;
    if (typeof body !== "object" || body === null || !("payload" in body))
      throw new Error("A payload object is required.");
    const record = body as { payload: unknown };
    const action = await editAction(id, record.payload, actor);
    return NextResponse.json(action);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
