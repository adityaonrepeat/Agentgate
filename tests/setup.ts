import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "agentgate-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(directory, "test.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
