import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { payloadHash } from "../lib/canonical";
import { executeAction } from "../lib/gate";
import type {
  ActionRequest,
  Actor,
  Approval,
  ApprovalStore,
  AuditEvent,
  Execution,
} from "../lib/types";

class MemoryStore implements ApprovalStore {
  readonly executions: Execution[] = [];
  readonly audits: AuditEvent[] = [];
  constructor(
    readonly action: ActionRequest,
    readonly approval: Approval,
  ) {}
  async getAction(id: string): Promise<ActionRequest | null> {
    return id === this.action.id ? this.action : null;
  }

  async getApproval(id: string): Promise<Approval | null> {
    return id === this.approval.id ? this.approval : null;
  }

  async consumeApproval(id: string, consumedAt: Date): Promise<boolean> {
    if (id !== this.approval.id || this.approval.consumedAt) return false;
    this.approval.consumedAt = consumedAt;
    return true;
  }

  async markExecuted(): Promise<void> {
    this.action.status = "executed";
  }

  async insertExecution(value: Execution): Promise<void> {
    this.executions.push(value);
  }

  async insertAudit(value: AuditEvent): Promise<void> {
    this.audits.push(value);
  }
}

const actor: Actor = { sub: "namoid_riya", name: "Riya Shah", email: "riya@example.test" };

function fixture(): MemoryStore {
  const payload = {
    orderId: "ORD-1042",
    customerRef: "CUS-102",
    amountMinor: 120000,
    currency: "INR" as const,
    reason: "Product arrived damaged",
  };

  const action: ActionRequest = {
    id: randomUUID(),
    type: "refund.issue",
    agentId: "support-agent",
    agentRunId: "run-1",
    agentRationale: "Customer supplied photos.",
    originalPayload: payload,
    currentPayload: { ...payload },
    payloadVersion: 1,
    payloadHash: payloadHash("refund.issue", payload),
    status: "approved",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  };

  const approval: Approval = {
    id: randomUUID(),
    actionRequestId: action.id,
    decision: "approve",
    boundPayloadHash: action.payloadHash,
    decidedBySub: actor.sub,
    decidedByName: actor.name,
    decidedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };

  return new MemoryStore(action, approval);
}
describe("execution gate", () => {
  it("allows the happy path once", async () => {
    const store = fixture();
    expect(
      (
        await executeAction(store, {
          actionRequestId: store.action.id,
          approvalId: store.approval.id,
          actor,
        })
      ).outcome,
    ).toBe("allowed");
    expect(store.action.status).toBe("executed");
  });
  it("blocks direct database payload tampering", async () => {
    const store = fixture();
    (store.action.currentPayload as { amountMinor: number }).amountMinor = 1;
    const result = await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor,
    });
    expect(result.reasonCode).toBe("BLOCKED_PAYLOAD_CHANGED_AFTER_APPROVAL");
  });
  it("blocks an approval after the normal edit path changes the amount", async () => {
    const store = fixture();
    store.action.currentPayload = {
      ...(store.action.currentPayload as {
        orderId: string;
        customerRef: string;
        amountMinor: number;
        currency: "INR";
        reason: string;
      }),
      amountMinor: 125000,
    };

    store.action.payloadHash = payloadHash(store.action.type, store.action.currentPayload);
    const result = await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor,
    });
    expect(result.reasonCode).toBe("BLOCKED_PAYLOAD_CHANGED_AFTER_APPROVAL");
  });
  it("blocks replay", async () => {
    const store = fixture();
    await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor,
    });
    const second = await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor,
    });
    expect(second.reasonCode).toBe("BLOCKED_APPROVAL_ALREADY_CONSUMED");
    expect(store.executions.filter((row) => row.outcome === "allowed")).toHaveLength(1);
  });
  it("blocks expiry", async () => {
    const store = fixture();
    store.approval.expiresAt = new Date(Date.now() - 1);
    expect(
      (
        await executeAction(store, {
          actionRequestId: store.action.id,
          approvalId: store.approval.id,
          actor,
        })
      ).reasonCode,
    ).toBe("BLOCKED_APPROVAL_EXPIRED");
  });
  it("records the authenticated caller rather than an approval's original decider", async () => {
    const store = fixture();
    const meera: Actor = { sub: "namoid_meera", name: "Meera Patel", email: "meera@example.test" };
    const result = await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor: meera,
    });
    expect(result.execution.attemptedBySub).toBe(meera.sub);
    expect(result.execution.attemptedBySub).not.toBe(store.approval.decidedBySub);
  });
  it("writes audit data without raw customer payload values or token fields", async () => {
    const store = fixture();
    await executeAction(store, {
      actionRequestId: store.action.id,
      approvalId: store.approval.id,
      actor,
    });
    const audit = JSON.stringify(store.audits[0]);
    expect(audit).not.toContain("ORD-1042");
    expect(audit).not.toContain("120000");
    expect(audit).not.toContain("idToken");
    expect(audit).not.toContain("access_token");
  });
});
