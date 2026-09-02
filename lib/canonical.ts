import { createHash } from "node:crypto";
import type { ActionPayload, ActionType } from "./types";

type CanonicalValue =
  null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalValue(value: unknown): CanonicalValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  )
    throw new Error("Payload contains a non-canonical value");
  if (Array.isArray(value)) return value.map(canonicalValue);

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objectValue)
        .sort()
        .map((key) => [key, canonicalValue(objectValue[key])]),
    ) as { [key: string]: CanonicalValue };
  }

  throw new Error("Unsupported payload value");
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function payloadHash(type: ActionType, payload: ActionPayload): string {
  return createHash("sha256").update(canonicalize({ type, payload })).digest("hex");
}

export function changedFields(previous: ActionPayload, current: ActionPayload): string[] {
  const before = previous as unknown as Record<string, unknown>;
  const after = current as unknown as Record<string, unknown>;

  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => canonicalize(before[key]) !== canonicalize(after[key]))
    .sort();
}
