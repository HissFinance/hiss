/**
 * Canonical MCP tool registry — the SINGLE source of truth for the set and
 * count of public HISS MCP tools.
 *
 * The registry is DERIVED FROM SOURCE at runtime by parsing the tool
 * definitions in `packages/mcp-server/src/tools.ts`. Nothing here hardcodes the
 * tool count; `check:skill-tool-refs` and the docs-count assertions all read
 * from this module so a change in the server source is the only place a tool is
 * added or removed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../lib/walk.ts";

// The canonical MCP tool set is spread across the base registry, the
// Stock-Premium engine-bridge module, and the Lighter READ/PREPARE module (all
// spread into `HISS_TOOLS`).
const TOOLS_SOURCES = [
  join(REPO_ROOT, "packages/mcp-server/src/tools.ts"),
  join(REPO_ROOT, "packages/mcp-server/src/tools-stock-premium.ts"),
  join(REPO_ROOT, "packages/mcp-server/src/tools-lighter.ts"),
];

/** A tool name in the HISS MCP namespace (snake_case, `hiss_` prefix). */
const TOOL_NAME_RE = /name:\s*"(hiss_[a-z0-9_]+)"/g;

/** The array a tool belongs to in the source, used to classify read vs prepare. */
const READ_ARRAY_RE = /const\s+READ_TOOLS\s*[:=]/;
const PREPARE_ARRAY_RE = /const\s+PREPARE_TOOLS\s*[:=]/;

export interface CanonicalRegistry {
  /** All canonical MCP tool names, sorted. */
  tools: string[];
  /** Fast membership set. */
  set: Set<string>;
  /** Total count — generated from source, never hardcoded. */
  count: number;
  /** Read-only tool names (best-effort split from source). */
  readTools: string[];
  /** Prepare-only tool names (best-effort split from source). */
  prepareTools: string[];
}

/** Load and parse the canonical registry from the MCP server source. */
export function loadCanonicalRegistry(): CanonicalRegistry {
  const sources = TOOLS_SOURCES.map((p) => ({ path: p, src: readFileSync(p, "utf8") }));

  const names: string[] = [];
  for (const { src } of sources) {
    for (const m of src.matchAll(TOOL_NAME_RE)) names.push(m[1]);
  }
  const unique = [...new Set(names)];
  if (unique.length === 0) {
    throw new Error(`mcp-registry: no hiss_* tools found in ${TOOLS_SOURCES.join(", ")}`);
  }

  // Best-effort read/prepare split: partition the base source at the PREPARE
  // array, then classify each additional tool module by its `kind:` field.
  const readTools: string[] = [];
  const prepareTools: string[] = [];
  const base = sources[0].src;
  const readIdx = base.search(READ_ARRAY_RE);
  const prepareIdx = base.search(PREPARE_ARRAY_RE);
  if (readIdx >= 0 && prepareIdx > readIdx) {
    const readSection = base.slice(readIdx, prepareIdx);
    const prepareSection = base.slice(prepareIdx);
    for (const m of readSection.matchAll(TOOL_NAME_RE)) readTools.push(m[1]);
    for (const m of prepareSection.matchAll(TOOL_NAME_RE)) prepareTools.push(m[1]);
  }
  // Additional modules (e.g. tools-stock-premium.ts): classify each tool by the
  // nearest following `kind: "read" | "prepare"` in its definition block.
  const KIND_AFTER_NAME_RE = /name:\s*"(hiss_[a-z0-9_]+)"[\s\S]{0,240}?kind:\s*"(read|prepare)"/g;
  for (const { src } of sources.slice(1)) {
    for (const m of src.matchAll(KIND_AFTER_NAME_RE)) {
      (m[2] === "read" ? readTools : prepareTools).push(m[1]);
    }
  }

  const tools = [...unique].sort();
  return {
    tools,
    set: new Set(tools),
    count: tools.length,
    readTools: [...new Set(readTools)].sort(),
    prepareTools: [...new Set(prepareTools)].sort(),
  };
}

/** Levenshtein distance for "did you mean" suggestions. */
export function closestTool(name: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Only suggest if it is a plausibly close match.
  return best && bestD <= Math.max(4, Math.floor(name.length / 2)) ? best : null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
