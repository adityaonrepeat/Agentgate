import { randomUUID } from "node:crypto";
import { changedFields, payloadHash } from "./canonical";
import { validatePayload } from "./actions";
import { client, ensureSchema } from "./db";
import type { ActionRequest, Actor, Decision } from "./types";

const APPROVAL_TTL_MS = 10 * 60 * 1000;
const EDITABLE_STATUSES: ReadonlyArray<ActionRequest["status"]> = ["pending", "approved"];

const AUDIT_COLUMNS =
  "id, action_request_id, approval_id, actor_type, actor_id, actor_display, event, reason_code, changed_fields, payload_hash, created_at";

function stringValue(value: unknown, key: string): string {
  if (typeof value !== "string") throw new Error(`Expected ${key}`);

  return value;
}

async function readAction(id: string): Promise<ActionRequest> {
  await ensureSchema();
  const result = await client.execute({
    sql: "SELECT * FROM action_requests WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) throw new Error("Action request not found.");

  const type = stringValue(row.type, "type") as ActionRequest["type"];
  const current = JSON.parse(stringValue(row.current_payload, "current_payload")) as unknown;
  const original = JSON.parse(stringValue(row.original_payload, "original_payload")) as unknown;

  return {
    id: stringValue(row.id, "id"),
    type,
    agentId: stringValue(row.agent_id, "agent_id"),
    agentRunId: stringValue(row.agent_run_id, "agent_run_id"),
    agentRationale: stringValue(row.agent_rationale, "agent_rationale"),
    originalPayload: validatePayload(type, original),
    currentPayload: validatePayload(type, current),
    payloadVersion: typeof row.payload_version === "number" ? row.payload_version : 1,
    payloadHash: stringValue(row.payload_hash, "payload_hash"),
    status: stringValue(row.status, "status") as ActionRequest["status"],
    createdAt: new Date(stringValue(row.created_at, "created_at")),
    expiresAt: new Date(stringValue(row.expires_at, "expires_at")),
  };
}

export async function editAction(
  id: string,
  rawPayload: unknown,
  actor: Actor,
): Promise<ActionRequest> {
  const action = await readAction(id);
  if (!EDITABLE_STATUSES.includes(action.status))
    throw new Error("Only pending or approved actions can be edited.");

  const current = validatePayload(action.type, rawPayload);
  const hash = payloadHash(action.type, current);
  const version = action.payloadVersion + 1;
  const now = new Date().toISOString();
  const guard = "id = ? AND payload_version = ? AND status IN ('pending', 'approved')";

  // The audit insert runs before the update so its guard still sees the prior
  // row. The batch is one atomic round trip; if the guard misses, nothing
  // lands and the update reports no affected row.
  const results = await client.batch(
    [
      {
        sql: `INSERT INTO audit_events (${AUDIT_COLUMNS}) SELECT ?, ?, NULL, 'human', ?, ?, 'action.edited', NULL, ?, ?, ? FROM action_requests WHERE ${guard}`,
        args: [
          randomUUID(),
          id,
          actor.sub,
          actor.name,
          JSON.stringify(changedFields(action.currentPayload, current)),
          hash,
          now,
          id,
          action.payloadVersion,
        ],
      },
      {
        sql: `UPDATE action_requests SET current_payload = ?, payload_version = ?, payload_hash = ?, status = 'pending' WHERE ${guard}`,
        args: [JSON.stringify(current), version, hash, id, action.payloadVersion],
      },
    ],
    "write",
  );
  if (results[1].rowsAffected !== 1) throw new Error("The action changed during the edit.");

  return {
    ...action,
    currentPayload: current,
    payloadVersion: version,
    payloadHash: hash,
    status: "pending",
  };
}

export async function decideAction(
  id: string,
  decision: Decision,
  actor: Actor,
): Promise<{ approvalId: string; status: Decision }> {
  await ensureSchema();
  const approvalId = randomUUID();
  const now = new Date();
  const decidedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS).toISOString();
  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const event = decision === "approve" ? "action.approved" : "action.rejected";
  const guard = "id = ? AND status = 'pending'";

  // Both inserts read payload_hash straight from the still-pending row and run
  // before the status update, so the whole decision is one atomic round trip.
  const results = await client.batch(
    [
      {
        sql: `INSERT INTO approvals (id, action_request_id, decision, bound_payload_hash, decided_by_sub, decided_by_name, decided_at, expires_at, consumed_at) SELECT ?, ?, ?, payload_hash, ?, ?, ?, ?, NULL FROM action_requests WHERE ${guard}`,
        args: [approvalId, id, decision, actor.sub, actor.name, decidedAt, expiresAt, id],
      },
      {
        sql: `INSERT INTO audit_events (${AUDIT_COLUMNS}) SELECT ?, ?, ?, 'human', ?, ?, ?, NULL, '[]', payload_hash, ? FROM action_requests WHERE ${guard}`,
        args: [randomUUID(), id, approvalId, actor.sub, actor.name, event, decidedAt, id],
      },
      {
        sql: `UPDATE action_requests SET status = ? WHERE ${guard}`,
        args: [nextStatus, id],
      },
    ],
    "write",
  );
  if (results[2].rowsAffected !== 1) {
    const existing = await client.execute({
      sql: "SELECT status FROM action_requests WHERE id = ?",
      args: [id],
    });
    if (!existing.rows[0]) throw new Error("Action request not found.");
    throw new Error("Only pending actions can be decided.");
  }

  return { approvalId, status: decision };
}
