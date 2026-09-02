"use client";

import { useState } from "react";
import type { ActionPayload, ActionStatus } from "@/lib/types";

interface DecisionResponse {
  approvalId: string;
  status: "approve" | "reject";
}

interface ExecutionResponse {
  outcome: "allowed" | "blocked";
  reasonCode: string | null;
  reasonDetail: string;
}

interface ErrorResponse {
  error: string;
}

function isError(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

export function ActionControls({
  actionId,
  status,
  payload,
  initialApprovalId,
}: {
  actionId: string;
  status: ActionStatus;
  payload: ActionPayload;
  initialApprovalId: string | null;
}): React.ReactElement {
  const [draft, setDraft] = useState(JSON.stringify(payload, null, 2));
  const [approvalId, setApprovalId] = useState(initialApprovalId);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "approve" | "reject"): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(`/api/actions/${actionId}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await responseJson(response);
      if (isError(data)) throw new Error(data.error);
      const result = data as DecisionResponse;
      setApprovalId(result.approvalId);
      setMessage(
        decision === "approve"
          ? "Approved. The approval expires in 10 minutes and is bound to the payload shown above."
          : "Rejected. The simulated agent cannot execute this action.",
      );
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(): Promise<void> {
    setBusy(true);
    try {
      const parsed = JSON.parse(draft) as unknown;
      const response = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: parsed }),
      });
      const data = await responseJson(response);
      if (isError(data)) throw new Error(data.error);
      setApprovalId(null);
      setMessage(
        "Edit saved. The request is pending again; an earlier approval can no longer execute it.",
      );
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Edit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function execute(): Promise<void> {
    if (!approvalId) {
      setMessage("Approve this exact payload before executing it.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/actions/${actionId}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalId }),
      });
      const data = await responseJson(response);
      if (isError(data)) throw new Error(data.error);
      const result = data as ExecutionResponse;
      setMessage(
        result.outcome === "allowed"
          ? "Allowed: the simulated executor ran and consumed this approval."
          : `Blocked: ${result.reasonDetail}`,
      );
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setBusy(false);
    }
  }

  const pending = status === "pending";

  return (
    <section className="card">
      <h2>Decision controls</h2>
      <p className="meta">
        The decision is attributed to your authenticated NamoID session. Values in the browser
        cannot choose a different approver.
      </p>
      <textarea
        aria-label="Edit current action JSON"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={!pending || busy}
        style={{
          width: "100%",
          minHeight: 170,
          fontFamily: "ui-monospace,monospace",
          fontSize: 12,
          padding: 12,
          border: "1px solid #e4e7ec",
          borderRadius: 8,
        }}
      />
      <p>
        <button className="button secondary" onClick={saveEdit} disabled={!pending || busy}>
          Save edit
        </button>{" "}
        <button className="button" onClick={() => decide("approve")} disabled={!pending || busy}>
          Approve exact action
        </button>{" "}
        <button
          className="button secondary"
          onClick={() => decide("reject")}
          disabled={!pending || busy}
        >
          Reject
        </button>{" "}
        <button
          className="button"
          onClick={execute}
          disabled={busy || status === "rejected" || status === "executed"}
        >
          Execute approved action
        </button>
      </p>
      {message ? (
        <p className={message.startsWith("Allowed") ? "badge" : "badge blocked"}>{message}</p>
      ) : null}
    </section>
  );
}
