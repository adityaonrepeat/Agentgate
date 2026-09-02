import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/actor";
import { client, ensureSchema } from "@/lib/db";

function value(item: unknown): string {
  return typeof item === "string" ? item : "";
}

export const dynamic = "force-dynamic";

export default async function AuditPage(): Promise<React.ReactElement> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  await ensureSchema();
  const events = await client.execute("SELECT * FROM audit_events ORDER BY created_at DESC");

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Agent<span>Gate</span>
        </Link>
        <div className="navlinks">
          <Link href="/inbox">← Inbox</Link>
          <span className="meta">{actor.name}</span>
        </div>
      </nav>
      <div className="eyebrow">Redacted audit evidence</div>
      <h1>Every decision and execution attempt.</h1>
      <p className="meta">
        This view deliberately stores event metadata, hash values, and changed field names—not
        action payloads, tokens, or customer PII.
      </p>
      {events.rows.length === 0 ? (
        <section className="card">
          No events yet. Approval and execution attempts will appear here.
        </section>
      ) : (
        events.rows.map((event) => (
          <section className="card" key={value(event.id)}>
            <div className="split">
              <div>
                <b>{value(event.event)}</b>
                <p className="meta">
                  {value(event.actor_display)} ·{" "}
                  {new Date(value(event.created_at)).toLocaleString()}
                </p>
              </div>
              <span className={`badge ${value(event.reason_code) ? "blocked" : ""}`}>
                {value(event.reason_code) || "recorded"}
              </span>
            </div>
            <p className="meta">
              Action {value(event.action_request_id)} · payload hash {value(event.payload_hash)}
            </p>
          </section>
        ))
      )}
    </main>
  );
}
