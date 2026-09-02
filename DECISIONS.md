# Engineering decisions

## Scope

This six-hour POC deliberately protects two invariants: exact-payload approval
and single-use execution. It does not claim to be a complete authorization
platform. Every simulated action, including a small refund, uses the same human
approval gate; no low-risk bypass was introduced.

## Architecture

NamoID Hosted Auth verifies the human. The callback creates an AgentGate
application session. Next.js Route Handlers use that session to derive the
actor, modify libSQL state, and invoke the sole execution gate.

## Security and privacy

The browser never selects `decidedBySub` or an execution actor. Approvals bind
canonical SHA-256 payload hashes; hash mismatch blocks tampering. Atomic
`consumedAt IS NULL` updates block replay. Audit events structurally omit raw
payload objects and tokens, retaining only safe metadata and hashes.

NamoID credentials are environment variables. No refresh token is persisted.
Logout uses the documented SDK behavior with `clearHostedSession`; only add an
ID-token hint if verified NamoID behavior requires it.

## Testing

Eighteen unit tests prove the happy path, normal edit tampering, direct
storage tampering, replay, expiry, identity attribution, audit hygiene, the
decision and edit transactions against a real libSQL database, and the
mutation origin guard. Production
build, TypeScript check, and template validation also pass.

## With another hour

Wire real executor adapters through an outbox/idempotency layer, add richer UI
status refresh, then perform a complete deployed NamoID Test-user walkthrough
and record it for the submission.
