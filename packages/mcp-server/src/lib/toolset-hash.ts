/**
 * Deterministic toolset hash.
 *
 * A stable SHA-256 over the registered tools' identity + contract
 * (name, title, kind, description, inputSchema). Two deployments that expose
 * the byte-identical toolset produce the byte-identical hash, independent of
 * declaration order or object key order. Surfaced by `GET /version` so an
 * operator can prove which toolset a running instance serves without invoking
 * any tool. Pure — no I/O, no keys, no network.
 */

import { createHash } from "node:crypto";
import { HISS_TOOLS, type ToolDefinition } from "../tools.js";

/** Canonical JSON: object keys sorted recursively so the string is stable. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(",")}}`;
}

export interface ToolsetHash {
  /** `sha256:<hex>` over the canonical toolset. */
  hash: string;
  /** Number of tools folded into the hash. */
  toolCount: number;
  /** The tool names, sorted — a human-checkable companion to the hash. */
  toolNames: string[];
}

/** Compute the deterministic toolset hash for a set of tools (defaults to the registry). */
export function computeToolsetHash(tools: readonly ToolDefinition[] = HISS_TOOLS): ToolsetHash {
  const canonical = tools
    .map((t) => ({
      name: t.name,
      title: t.title,
      kind: t.kind,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const digest = createHash("sha256").update(stableStringify(canonical)).digest("hex");
  return {
    hash: `sha256:${digest}`,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name).sort(),
  };
}
