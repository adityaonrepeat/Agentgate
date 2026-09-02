# AgentGate

**[Powered by NamoID](https://namoid.in)** · [NamoID documentation](https://docs.namoid.in) · [Challenge catalog](https://challenges.namoid.in)

AgentGate is a proof-of-concept approval inbox for simulated AI business
actions. A NamoID-authenticated team member can inspect, edit, approve, reject,
or execute a request. It is deliberately small: its security model is built
around payload-bound approval and single-use execution.

This repository is an independent community build for NamoID's
`agent-approval-inbox` challenge, created from the [official template](https://github.com/namoidhq/namoid-challenge-template). It is not an official NamoID product, security recommendation, or endorsement.

## Demo

- Live application: https://agentgate-net.vercel.app
- Walkthrough recording: https://youtu.be/86EnzfI_8Zg

Sign-in runs through NamoID Hosted Auth. The seeded inbox contains four
simulated agent proposals; one is left pending so a reviewer can approve it,
edit the payload, and watch execution refuse the changed request.

## Approval model

An `ActionRequest` keeps both the agent's immutable `originalPayload` and the
human-editable `currentPayload`. Approval stores a SHA-256 hash of canonical
`{ type, currentPayload }`, the deciding person's server-derived NamoID subject,
and a 10-minute expiry.

At execution, the server checks authenticated session, approval ownership,
approved decision, expiry, payload hash equality, and atomically consumes the
approval only if `consumedAt IS NULL`. A changed amount, address, recipient, or
destination fails the hash check. A second execution fails the atomic consume.
Every allowed or blocked attempt receives a reason code and a redacted audit
event.

## NamoID Hosted Auth

AgentGate is a server-rendered Next.js application using `@namoidhq/nextjs`.
NamoID Hosted Auth performs the authentication ceremony and SDK callback
validation. AgentGate then creates its own opaque, HttpOnly, SameSite=Lax
application-session cookie. The session row holds identity details only; tokens
are never exposed to the browser or stored in audit records.

1. In NamoID Console, create a **Test server-rendered application**.
2. Register exactly these callback URLs:
   - `http://localhost:3000/api/auth/callback/namoid`
   - `https://<your-vercel-project>.vercel.app/api/auth/callback/namoid`
3. Create Test users for Riya and Meera, then copy the Client ID and Client
   Secret into `.env.local` or Vercel environment variables.
4. Register the matching post-logout URLs in NamoID if the Console requests
   them.

NamoID test-user email OTP exercises the real redirect, callback, session, and
identity path without sending a real email.

## Local development

```bash
npm install
Copy-Item .env.example .env.local
npm run db:push
npm run seed
npm test
npm run dev
```

Open `http://localhost:3000`. Until NamoID variables are configured, the login
page clearly reports that sign-in is unavailable. A configured app redirects to
Hosted Auth; no social-login button or local user identity bypass exists.

## Verification

The test suite contains eighteen focused tests across three files.

`tests/gate.test.ts` covers the execution gate:

- happy-path approval and execution;
- edited amount tampering;
- direct-database payload tampering;
- replay prevention;
- approval expiry;
- authenticated execution actor attribution;
- audit records free of raw customer payload values and token fields.

`tests/approval.test.ts` covers the decision and edit transactions against a
real libSQL database:

- an approval binds the current payload hash and the deciding subject;
- a second decision on the same action is refused;
- editing returns an approved action to pending and bumps its version;
- an executed action can no longer be edited;
- a refused edit rolls back its audit write;
- decision audit events carry no raw payload or token fields.

`tests/actor.test.ts` covers the mutation origin guard:

- a request with no `Origin` header is blocked;
- a request from another site is blocked;
- the request's own origin and the configured application URL are allowed;
- a trailing slash in the configured URL is ignored.

Commands run successfully during implementation:

```bash
npm test           # 18 passed
npx tsc --noEmit   # passed
npm run build      # passed
npm run check      # passed
npm run format:check
```

## Deploy

Create a Turso database, add its URL/token plus NamoID credentials to Vercel,
and set `NEXT_PUBLIC_APP_URL` to the exact HTTPS deployment origin. Run
`npm run db:push` once against Turso, deploy, then sign in through the deployed
NamoID callback before demonstrating the workflow.

## Limitations and next steps

All commerce, messaging, and report operations are fictional simulations. With
more time, add real adapter outboxes/idempotency, approval roles and thresholds,
dual control, resource-aware scopes, signed capabilities, tamper-evident audit
chains, retention controls, and MCP tool gating.

## External resources

Technical choices were verified against the current official NamoID SDK type
declarations and the official NamoID and Next.js documentation. Libraries
include Next.js, NamoID SDKs, libSQL, Zod, TypeScript, and Vitest.
