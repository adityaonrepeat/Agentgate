import { createClient, type Client, type Row, type Transaction } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { payloadHash } from "./canonical";
import type {
  ActionPayload,
  ActionRequest,
  Actor,
  Approval,
  ApprovalStore,
  AuditEvent,
  Execution,
  TransactionalApprovalStore,
} from "./types";

const url = process.env.TURSO_DATABASE_URL || "file:agentgate.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
export const client: Client = createClient(authToken ? { url, authToken } : { url });

const schemaSql = `
CREATE TABLE IF NOT EXISTS action_requests (id TEXT PRIMARY KEY, type TEXT NOT NULL, agent_id TEXT NOT NULL, agent_run_id TEXT NOT NULL, agent_rationale TEXT NOT NULL, original_payload TEXT NOT NULL, current_payload TEXT NOT NULL, payload_version INTEGER NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, action_request_id TEXT NOT NULL, decision TEXT NOT NULL, bound_payload_hash TEXT NOT NULL, decided_by_sub TEXT NOT NULL, decided_by_name TEXT NOT NULL, decided_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT);
CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, action_request_id TEXT NOT NULL, approval_id TEXT NOT NULL, attempted_by_sub TEXT NOT NULL, outcome TEXT NOT NULL, reason_code TEXT, reason_detail TEXT, simulated_result_ref TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_allowed_execution_per_approval ON executions(approval_id) WHERE outcome = 'allowed';
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, action_request_id TEXT NOT NULL, approval_id TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, actor_display TEXT NOT NULL, event TEXT NOT NULL, reason_code TEXT, changed_fields TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sub TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
`;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  schemaReady ??= client.executeMultiple(schemaSql);

  return schemaReady;
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected text column ${key}`);

  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null) return null;

  if (typeof value !== "string") throw new Error(`Expected nullable text column ${key}`);

  return value;
}

function integer(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Expected number column ${key}`);

  return value;
}

function parsePayload(value: string): ActionPayload {
  return JSON.parse(value) as unknown as ActionPayload;
}

function actionFrom(row: Row): ActionRequest {
  return {
    id: text(row, "id"),
    type: text(row, "type") as ActionRequest["type"],
    agentId: text(row, "agent_id"),
    agentRunId: text(row, "agent_run_id"),
    agentRationale: text(row, "agent_rationale"),
    originalPayload: parsePayload(text(row, "original_payload")),
    currentPayload: parsePayload(text(row, "current_payload")),
    payloadVersion: integer(row, "payload_version"),
    payloadHash: text(row, "payload_hash"),
    status: text(row, "status") as ActionRequest["status"],
    createdAt: new Date(text(row, "created_at")),
    expiresAt: new Date(text(row, "expires_at")),
  };
}

function approvalFrom(row: Row): Approval {
  const consumedAt = nullableText(row, "consumed_at");

  return {
    id: text(row, "id"),
    actionRequestId: text(row, "action_request_id"),
    decision: text(row, "decision") as Approval["decision"],
    boundPayloadHash: text(row, "bound_payload_hash"),
    decidedBySub: text(row, "decided_by_sub"),
    decidedByName: text(row, "decided_by_name"),
    decidedAt: new Date(text(row, "decided_at")),
    expiresAt: new Date(text(row, "expires_at")),
    consumedAt: consumedAt ? new Date(consumedAt) : null,
  };
}

export class SqlApprovalStore implements TransactionalApprovalStore {
  constructor(private readonly executor: Client | Transaction = client) {}
  async getAction(id: string): Promise<ActionRequest | null> {
    const result = await this.executor.execute({
      sql: "SELECT * FROM action_requests WHERE id = ?",
      args: [id],
    });
    return result.rows[0] ? actionFrom(result.rows[0]) : null;
  }

  async getApproval(id: string): Promise<Approval | null> {
    const result = await this.executor.execute({
      sql: "SELECT * FROM approvals WHERE id = ?",
      args: [id],
    });
    return result.rows[0] ? approvalFrom(result.rows[0]) : null;
  }

  async consumeApproval(id: string, consumedAt: Date): Promise<boolean> {
    const result = await this.executor.execute({
      sql: "UPDATE approvals SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
      args: [consumedAt.toISOString(), id],
    });
    return result.rowsAffected === 1;
  }

  async markExecuted(id: string): Promise<void> {
    await this.executor.execute({
      sql: "UPDATE action_requests SET status = 'executed' WHERE id = ?",
      args: [id],
    });
  }

  async insertExecution(value: Execution): Promise<void> {
    await this.executor.execute({
      sql: "INSERT INTO executions (id, action_request_id, approval_id, attempted_by_sub, outcome, reason_code, reason_detail, simulated_result_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        value.id,
        value.actionRequestId,
        value.approvalId,
        value.attemptedBySub,
        value.outcome,
        value.reasonCode,
        value.reasonDetail,
        value.simulatedResultRef,
        value.createdAt.toISOString(),
      ],
    });
  }

  async insertAudit(value: AuditEvent): Promise<void> {
    await this.executor.execute({
      sql: "INSERT INTO audit_events (id, action_request_id, approval_id, actor_type, actor_id, actor_display, event, reason_code, changed_fields, payload_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        value.id,
        value.actionRequestId,
        value.approvalId,
        value.actorType,
        value.actorId,
        value.actorDisplay,
        value.event,
        value.reasonCode,
        JSON.stringify(value.changedFields),
        value.payloadHash,
        value.createdAt.toISOString(),
      ],
    });
  }

  async transaction<T>(operation: (store: ApprovalStore) => Promise<T>): Promise<T> {
    const transaction = await client.transaction("write");
    try {
      const result = await operation(new SqlApprovalStore(transaction));
      await transaction.commit();
      return result;
    } catch (error: unknown) {
      await transaction.rollback();
      throw error;
    }
  }
}

export async function createSession(actor: Actor): Promise<string> {
  await ensureSchema();
  const sid = randomUUID();
  const now = new Date();
  await client.execute({
    sql: "INSERT INTO sessions (sid, sub, name, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      sid,
      actor.sub,
      actor.name,
      actor.email,
      now.toISOString(),
      new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    ],
  });

  return sid;
}

export async function getSession(sid: string): Promise<Actor | null> {
  await ensureSchema();
  const result = await client.execute({
    sql: "SELECT sub,name,email FROM sessions WHERE sid = ? AND expires_at > ?",
    args: [sid, new Date().toISOString()],
  });
  const row = result.rows[0];

  return row ? { sub: text(row, "sub"), name: text(row, "name"), email: text(row, "email") } : null;
}

export async function seedActions(): Promise<void> {
  await ensureSchema();
  const exists = await client.execute("SELECT id FROM action_requests LIMIT 1");
  if (exists.rows.length) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const proposals: Array<{
    id: string;
    type: ActionRequest["type"];
    rationale: string;
    payload: ActionPayload;
  }> = [
    {
      id: "act_refund_1042",
      type: "refund.issue",
      rationale: "Customer submitted fictional photo evidence of a damaged serum bottle.",
      payload: {
        orderId: "ORD-1042",
        customerRef: "CUS-102",
        amountMinor: 120000,
        currency: "INR",
        reason: "Damaged product evidence received",
      },
    },

    {
      id: "act_message_208",
      type: "message.send",
      rationale: "A delivery delay needs a reviewed customer update before sending.",
      payload: {
        channel: "whatsapp",
        toMasked: "+91 ••••• ••210",
        templateId: "delivery-delay-v1",
        body: "Hi Asha, your fictional skincare order will arrive tomorrow.",
      },
    },

    {
      id: "act_address_331",
      type: "order.address.change",
      rationale: "The customer requested a new fictional delivery address after checkout.",
      payload: {
        orderId: "ORD-1331",
        currentAddress: "12 Lake Road, Pune",
        newAddress: "44 Palm Avenue, Pune",
      },
    },

    {
      id: "act_export_772",
      type: "report.export",
      rationale:
        "The operations agent requests an export containing simulated customer information.",
      payload: {
        reportType: "customer-orders",
        rowCount: 240,
        includesPII: true,
        deliverTo: "ops-archive@example.test",
      },
    },
  ];
  for (const proposal of proposals)
    await client.execute({
      sql: "INSERT INTO action_requests (id, type, agent_id, agent_run_id, agent_rationale, original_payload, current_payload, payload_version, payload_hash, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        proposal.id,
        proposal.type,
        "skincare-support-agent",
        "run_2026_08_31",
        proposal.rationale,
        JSON.stringify(proposal.payload),
        JSON.stringify(proposal.payload),
        1,
        payloadHash(proposal.type, proposal.payload),
        "pending",
        now.toISOString(),
        expiresAt,
      ],
    });
}
