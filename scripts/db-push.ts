import { ensureSchema } from "../lib/db";

await ensureSchema();
console.log("AgentGate database schema is ready.");
