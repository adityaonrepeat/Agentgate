import { beforeEach, describe, expect, it } from "vitest";
import { client, ensureSchema, seedActions } from "../lib/db";
import { decideAction, editAction } from "../lib/approval";
import type { Actor } from "../lib/types";

const riya: Actor = { sub: "namoid_riya", name: "Riya", email: "riya@example.test" };

async function refundAction(): Promise<{ id: string; payload: Record<string, unknown> }> {
  const result = await client.execute(
    "SELECT id, current_payload FROM action_requests WHERE type = 'refund.issue'",
  );
  const row = result.rows[0];

  return {
    id: row.id as string,
    payload: JSON.parse(row.current_payload as string) as Record<string, unknown>,
  };
}

beforeEach(async () => {
  await ensureSchema();
  await client.executeMultiple(
    "DELETE FROM action_requests; DELETE FROM approvals; DELETE FROM audit_events; DELETE FROM executions;",
  );
  await seedActions();
});

describe("approval transactions", () => {
  it("binds the approval to the current payload hash", async () => {
    const { id } = await refundAction();
    const { approvalId } = await decideAction(id, "approve", riya);
    const approval = await client.execute({
      sql: "SELECT bound_payload_hash, decided_by_sub FROM approvals WHERE id = ?",
      args: [approvalId],
    });
    const action = await client.execute({
      sql: "SELECT payload_hash FROM action_requests WHERE id = ?",
      args: [id],
    });

    expect(approval.rows[0].bound_payload_hash).toBe(action.rows[0].payload_hash);
    expect(approval.rows[0].decided_by_sub).toBe(riya.sub);
  });

  it("refuses a second decision on the same action", async () => {
    const { id } = await refundAction();
    await decideAction(id, "approve", riya);

    await expect(decideAction(id, "approve", riya)).rejects.toThrow(
      "Only pending actions can be decided.",
    );
    const approvals = await client.execute("SELECT COUNT(*) AS total FROM approvals");
    expect(approvals.rows[0].total).toBe(1);
  });

  it("returns an edited action to pending and bumps its version", async () => {
    const { id, payload } = await refundAction();
    await decideAction(id, "approve", riya);
    const edited = await editAction(id, { ...payload, amountMinor: 999 }, riya);

    expect(edited.status).toBe("pending");
    expect(edited.payloadVersion).toBe(2);
  });

  it("refuses to edit an action that already executed", async () => {
    const { id, payload } = await refundAction();
    await client.execute({
      sql: "UPDATE action_requests SET status = 'executed' WHERE id = ?",
      args: [id],
    });

    await expect(editAction(id, { ...payload, amountMinor: 1 }, riya)).rejects.toThrow(
      "Only pending or approved actions can be edited.",
    );
  });

  it("rolls back the audit write when an edit is refused", async () => {
    const { id, payload } = await refundAction();
    await client.execute({
      sql: "UPDATE action_requests SET status = 'executed' WHERE id = ?",
      args: [id],
    });
    await editAction(id, payload, riya).catch(() => undefined);

    const audits = await client.execute({
      sql: "SELECT COUNT(*) AS total FROM audit_events WHERE action_request_id = ? AND event = 'action.edited'",
      args: [id],
    });
    expect(audits.rows[0].total).toBe(0);
  });

  it("records only safe metadata in the decision audit event", async () => {
    const { id } = await refundAction();
    await decideAction(id, "approve", riya);
    const audit = await client.execute({
      sql: "SELECT * FROM audit_events WHERE action_request_id = ? AND event = 'action.approved'",
      args: [id],
    });
    const serialized = JSON.stringify(audit.rows[0]);

    expect(serialized).not.toContain("ORD-");
    expect(serialized).not.toContain("idToken");
    expect(serialized).not.toContain("access_token");
  });
});
