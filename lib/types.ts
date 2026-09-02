export type ActionType = "refund.issue" | "message.send" | "order.address.change" | "report.export";
export type ActionStatus = "pending" | "approved" | "rejected" | "expired" | "executed";
export type Decision = "approve" | "reject";
export type ExecutionOutcome = "allowed" | "blocked";

export interface RefundPayload {
  orderId: string;
  customerRef: string;
  amountMinor: number;
  currency: "INR";
  reason: string;
}

export interface MessagePayload {
  channel: "whatsapp" | "email";
  toMasked: string;
  templateId: string;
  body: string;
}

export interface AddressPayload {
  orderId: string;
  currentAddress: string;
  newAddress: string;
}

export interface ExportPayload {
  reportType: "customer-orders" | "refunds";
  rowCount: number;
  includesPII: boolean;
  deliverTo: string;
}

export type ActionPayload = RefundPayload | MessagePayload | AddressPayload | ExportPayload;

export interface Actor {
  sub: string;
  name: string;
  email: string;
}

export interface ActionRequest {
  id: string;
  type: ActionType;
  agentId: string;
  agentRunId: string;
  agentRationale: string;
  originalPayload: ActionPayload;
  currentPayload: ActionPayload;
  payloadVersion: number;
  payloadHash: string;
  status: ActionStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface Approval {
  id: string;
  actionRequestId: string;
  decision: Decision;
  boundPayloadHash: string;
  decidedBySub: string;
  decidedByName: string;
  decidedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface Execution {
  id: string;
  actionRequestId: string;
  approvalId: string;
  attemptedBySub: string;
  outcome: ExecutionOutcome;
  reasonCode: string | null;
  reasonDetail: string | null;
  simulatedResultRef: string | null;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  actionRequestId: string;
  approvalId: string | null;
  actorType: "agent" | "human" | "system";
  actorId: string;
  actorDisplay: string;
  event: string;
  reasonCode: string | null;
  changedFields: string[];
  payloadHash: string;
  createdAt: Date;
}

export interface ExecutionResult {
  outcome: ExecutionOutcome;
  reasonCode: string | null;
  reasonDetail: string;
  execution: Execution;
}

export interface ApprovalStore {
  getAction(id: string): Promise<ActionRequest | null>;
  getApproval(id: string): Promise<Approval | null>;
  consumeApproval(id: string, consumedAt: Date): Promise<boolean>;
  markExecuted(id: string): Promise<void>;
  insertExecution(execution: Execution): Promise<void>;
  insertAudit(event: AuditEvent): Promise<void>;
}

export interface TransactionalApprovalStore extends ApprovalStore {
  transaction<T>(operation: (store: ApprovalStore) => Promise<T>): Promise<T>;
}
