import Link from "next/link";
import { getCurrentActor } from "@/lib/actor";
export const dynamic = "force-dynamic";
export default async function HomePage(): Promise<React.ReactElement> {
  const actor = await getCurrentActor();
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Agent<span>Gate</span>
        </Link>
        <div className="navlinks">
          {actor ? (
            <Link href="/inbox">Open inbox</Link>
          ) : (
            <Link className="button" href="/login">
              Team sign in
            </Link>
          )}
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow">Human decision required</div>
        <h1>Give AI agents a safe final mile.</h1>
        <p>
          AgentGate lets Riya's team inspect, edit, approve, or reject simulated operational
          actions. Every approval binds to one exact payload and can only be consumed once.
        </p>
        <Link className="button" href={actor ? "/inbox" : "/login"}>
          {actor ? "Go to approval inbox" : "Sign in with NamoID"}
        </Link>
      </section>
      <section className="grid">
        <div className="stat">
          <b>Exact payloads</b>Changing a refund amount, address, or export destination invalidates
          approval.
        </div>
        <div className="stat">
          <b>One execution</b>An atomic consume step blocks replay attempts.
        </div>
        <div className="stat">
          <b>Human evidence</b>Server-derived decision identity and redacted audit history.
        </div>
      </section>
    </main>
  );
}
