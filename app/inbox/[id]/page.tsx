import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/actor";
import { client, ensureSchema, seedActions } from "@/lib/db";
import { summarizeAction } from "@/lib/actions";
import type { ActionPayload, ActionStatus, ActionType } from "@/lib/types";
import { ActionControls } from "./action-controls";

function value(item: unknown): string {
  return typeof item === "string" ? item : "";
}

export const dynamic = "force-dynamic";

export default async function ActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  await ensureSchema();
  await seedActions();
  const { id } = await params;
  const result = await client.execute({
    sql: "SELECT * FROM action_requests WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) notFound();
  const type = value(row.type) as ActionType;
  const original = JSON.parse(value(row.original_payload)) as unknown as ActionPayload;
  const current = JSON.parse(value(row.current_payload)) as unknown as ActionPayload;
  const status = value(row.status) as ActionStatus;
  const approval = await client.execute({
    sql: "SELECT * FROM approvals WHERE action_request_id = ? ORDER BY decided_at DESC LIMIT 1",
    args: [id],
  });
  const approvalRow = approval.rows[0];

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Agent<span>Gate</span>
        </Link>
        <div className="navlinks">
          <Link href="/inbox">Back to inbox</Link>
          <span className="meta">{actor.name}</span>
        </div>
      </nav>
      <div className="eyebrow">Action request</div>
      <h1>{summarizeAction(type, current)}</h1>
      <div className="grid">
        <section className="card">
          <b>Requested by</b>
          <p>skincare-support-agent</p>
          <p className="meta">Simulated AI · run {value(row.agent_run_id)}</p>
        </section>
        <section className="card">
          <b>Status</b>
          <p>
            <span className="badge pending">{status}</span>
          </p>
          <p className="meta">Expires {new Date(value(row.expires_at)).toLocaleString()}</p>
        </section>
        <section className="card">
          <b>Approval</b>
          <p>
            {approvalRow
              ? `Decided by ${value(approvalRow.decided_by_name)}`
              : "No human decision yet"}
          </p>
          <p className="meta">A decision binds the exact current payload.</p>
        </section>
      </div>
      <section className="card">
        <h2>What the agent is asking permission to do</h2>
        <p>{value(row.agent_rationale)}</p>
        <h3>Original proposal</h3>
        <pre>{JSON.stringify(original, null, 2)}</pre>
        <h3>Current action</h3>
        <pre>{JSON.stringify(current, null, 2)}</pre>
        <p className="meta">Payload hash: {value(row.payload_hash)}</p>
      </section>
      <ActionControls
        actionId={id}
        status={status}
        payload={current}
        initialApprovalId={approvalRow ? value(approvalRow.id) : null}
      />
    </main>
  );
}
