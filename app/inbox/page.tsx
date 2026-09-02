import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/actor";
import { client, ensureSchema, seedActions } from "@/lib/db";
import { summarizeAction } from "@/lib/actions";
import type { ActionPayload, ActionType } from "@/lib/types";

interface InboxRow {
  id: string;
  type: ActionType;
  status: string;
  agentRationale: string;
  currentPayload: ActionPayload;
  createdAt: string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const dynamic = "force-dynamic";

export default async function InboxPage(): Promise<React.ReactElement> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  await ensureSchema();
  await seedActions();
  const result = await client.execute(
    "SELECT id,type,status,agent_rationale,current_payload,created_at FROM action_requests ORDER BY created_at DESC",
  );
  const rows: InboxRow[] = result.rows.map((row) => ({
    id: readString(row.id),
    type: readString(row.type) as ActionType,
    status: readString(row.status),
    agentRationale: readString(row.agent_rationale),
    currentPayload: JSON.parse(readString(row.current_payload)) as unknown as ActionPayload,
    createdAt: readString(row.created_at),
  }));

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Agent<span>Gate</span>
        </Link>
        <div className="navlinks">
          <span className="meta">{actor.name}</span>
          <Link href="/audit">Audit log</Link>
        </div>
      </nav>
      <div className="split">
        <section>
          <div className="eyebrow">Approval inbox</div>
          <h1>Actions waiting for a person.</h1>
        </section>
        <span className="badge pending">
          {rows.filter((row) => row.status === "pending").length} pending
        </span>
      </div>
      {rows.map((row) => (
        <article className="card" key={row.id}>
          <div className="split">
            <div>
              <span className={`badge ${row.status === "pending" ? "pending" : ""}`}>
                {row.status}
              </span>
              <h2>{summarizeAction(row.type, row.currentPayload)}</h2>
              <p>{row.agentRationale}</p>
              <p className="meta">
                Requested by simulated skincare-support-agent ·{" "}
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <Link className="button secondary" href={`/inbox/${row.id}`}>
              Review action
            </Link>
          </div>
        </article>
      ))}
    </main>
  );
}
