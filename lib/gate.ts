import { randomUUID } from "node:crypto";
import { payloadHash } from "./canonical";
import type {
  Actor,
  ApprovalStore,
  AuditEvent,
  Execution,
  ExecutionResult,
  TransactionalApprovalStore,
} from "./types";

function blocked(
  actionRequestId: string,
  approvalId: string,
  actor: Actor,
  code: string,
  detail: string,
): ExecutionResult {
  const execution: Execution = {
    id: randomUUID(),
    actionRequestId,
    approvalId,
    attemptedBySub: actor.sub,
    outcome: "blocked",
    reasonCode: code,
    reasonDetail: detail,
    simulatedResultRef: null,
    createdAt: new Date(),
  };

  return { outcome: "blocked", reasonCode: code, reasonDetail: detail, execution };
}

function auditFor(execution: Execution, hash: string, actor: Actor): AuditEvent {
  return {
    id: randomUUID(),
    actionRequestId: execution.actionRequestId,
    approvalId: execution.approvalId,
    actorType: "human",
    actorId: actor.sub,
    actorDisplay: actor.name,
    event: execution.outcome === "allowed" ? "execution.allowed" : "execution.blocked",
    reasonCode: execution.reasonCode,
    changedFields: [],
    payloadHash: hash,
    createdAt: execution.createdAt,
  };
}

function hasTransaction(store: ApprovalStore): store is TransactionalApprovalStore {
  return "transaction" in store && typeof store.transaction === "function";
}

async function executeInStore(
  store: ApprovalStore,
  input: { actionRequestId: string; approvalId: string; actor: Actor; now?: Date },
): Promise<ExecutionResult> {
  const now = input.now ?? new Date();
  const action = await store.getAction(input.actionRequestId);
  if (!action) {
    const result = blocked(
      input.actionRequestId,
      input.approvalId,
      input.actor,
      "BLOCKED_ACTION_NOT_FOUND",
      "The action request no longer exists.",
    );
    await store.insertExecution(result.execution);
    return result;
  }

  const approval = await store.getApproval(input.approvalId);
  if (!approval) {
    const result = blocked(
      action.id,
      input.approvalId,
      input.actor,
      "BLOCKED_APPROVAL_NOT_FOUND",
      "No approval was found.",
    );
    await store.insertExecution(result.execution);
    await store.insertAudit(auditFor(result.execution, action.payloadHash, input.actor));
    return result;
  }

  let code: string | null = null;
  let detail = "";
  if (approval.actionRequestId !== action.id) {
    code = "BLOCKED_APPROVAL_ACTION_MISMATCH";
    detail = "The approval belongs to a different action.";
  } else if (approval.decision !== "approve") {
    code = "BLOCKED_ACTION_REJECTED";
    detail = "The action was rejected.";
  } else if (now >= approval.expiresAt) {
    code = "BLOCKED_APPROVAL_EXPIRED";
    detail = "The approval expired before execution.";
  } else if (payloadHash(action.type, action.currentPayload) !== approval.boundPayloadHash) {
    code = "BLOCKED_PAYLOAD_CHANGED_AFTER_APPROVAL";
    detail = "The action payload changed after approval.";
  }

  if (code) {
    const result = blocked(action.id, approval.id, input.actor, code, detail);
    await store.insertExecution(result.execution);
    await store.insertAudit(auditFor(result.execution, action.payloadHash, input.actor));
    return result;
  }

  if (!(await store.consumeApproval(approval.id, now))) {
    const result = blocked(
      action.id,
      approval.id,
      input.actor,
      "BLOCKED_APPROVAL_ALREADY_CONSUMED",
      "This approval was already used.",
    );
    await store.insertExecution(result.execution);
    await store.insertAudit(auditFor(result.execution, action.payloadHash, input.actor));
    return result;
  }

  await store.markExecuted(action.id);
  const execution: Execution = {
    id: randomUUID(),
    actionRequestId: action.id,
    approvalId: approval.id,
    attemptedBySub: input.actor.sub,
    outcome: "allowed",
    reasonCode: null,
    reasonDetail: null,
    simulatedResultRef: `sim_${randomUUID()}`,
    createdAt: now,
  };

  await store.insertExecution(execution);
  await store.insertAudit(auditFor(execution, action.payloadHash, input.actor));

  return {
    outcome: "allowed",
    reasonCode: null,
    reasonDetail: "Execution was allowed and the approval was consumed.",
    execution,
  };
}

export async function executeAction(
  store: ApprovalStore,
  input: { actionRequestId: string; approvalId: string; actor: Actor; now?: Date },
): Promise<ExecutionResult> {
  return hasTransaction(store)
    ? store.transaction((transactionStore) => executeInStore(transactionStore, input))
    : executeInStore(store, input);
}
