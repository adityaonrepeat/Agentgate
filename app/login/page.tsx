import Link from "next/link";
import { namoidConfigured } from "@/lib/namoid";

export default function LoginPage(): React.ReactElement {
  const configured = namoidConfigured();

  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Agent<span>Gate</span>
        </Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">Team access</div>
        <h1>Sign in through NamoID Hosted Auth.</h1>
        <p>
          AgentGate never asks for a password. NamoID authenticates the person, then AgentGate
          creates its own secure application session.
        </p>
        {configured ? (
          <Link className="button" href="/api/auth/login">
            Continue to NamoID
          </Link>
        ) : (
          <div className="card">
            <b>Authentication is not configured yet.</b>
            <p className="meta">
              Set the three server environment variables documented in <code>.env.example</code>,
              then create a NamoID Test application with this app's callback URL.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
