/**
 * check:mcp-public-safe — the published MCP packages must stay public-safe.
 *
 * `packages/mcp-server` and `packages/sdk` are synced from the private
 * monorepo's publishable mirror. They must contain ZERO private-hosting
 * material: no private author handle, no private mirror container path, no
 * vendoring/provenance internals, and no hosted-deployment provenance FIELDS
 * (`publicSha` / `sourceSha`) in shipped source — provenance belongs to a
 * hosting layer, never to this package.
 *
 * The forbidden needles are assembled from fragments at runtime so this
 * scanner (and the other guards) can itself be scanned without self-tripping.
 *
 * Output contract:
 *   clean → "MCP_PUBLIC_SAFE_OK", exit 0.
 *   dirty → "MCP_PUBLIC_SAFE_BROKEN" + one line per leak, exit 1.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, rel } from "./lib/walk.ts";

// --- Needle fragments (kept split so the literals never appear verbatim) ---
const HANDLE = "Melted" + "Mindz";
const MIRROR_DIR = "mcp-" + "public";
const PROVENANCE_CONST = "PUBLIC_" + "SOURCE_" + "SHA";
const REVENDOR = "re-" + "vendor";

/** Leaks banned everywhere in the published packages (src + test). */
const HARD_BANS: Array<[RegExp, string]> = [
  [new RegExp(HANDLE, "i"), `private repo handle '${HANDLE}'`],
  [new RegExp(MIRROR_DIR), `private mirror container path '${MIRROR_DIR}'`],
  [new RegExp(PROVENANCE_CONST), `private provenance constant '${PROVENANCE_CONST}'`],
  [new RegExp(REVENDOR, "i"), `private vendoring term '${REVENDOR}'`],
];

/**
 * Provenance FIELDS the public package must never advertise. Banned in `src`
 * (the shipped package); allowed in `test` only where a test asserts their
 * ABSENCE (version-info.test.ts proves the package omits them).
 */
const SRC_ONLY_BANS: Array<[RegExp, string]> = [
  [/\bpublicSha\b/, "provenance field 'publicSha' (belongs to a private host layer)"],
  [/\bsourceSha\b/, "provenance field 'sourceSha' (belongs to a private host layer)"],
];

const PACKAGES = ["packages/mcp-server", "packages/sdk"];

const findings: string[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|json|md|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

function scan(files: string[], bans: Array<[RegExp, string]>): void {
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [re, label] of bans) {
        if (re.test(line)) findings.push(`${rel(file)}:${i + 1} — ${label}`);
      }
    });
  }
}

let srcCount = 0;
let testCount = 0;
for (const pkg of PACKAGES) {
  const srcDir = join(REPO_ROOT, pkg, "src");
  const testDir = join(REPO_ROOT, pkg, "test");
  if (existsSync(srcDir)) {
    const srcFiles = walk(srcDir);
    srcCount += srcFiles.length;
    scan(srcFiles, [...HARD_BANS, ...SRC_ONLY_BANS]);
  }
  if (existsSync(testDir)) {
    const testFiles = walk(testDir);
    testCount += testFiles.length;
    scan(testFiles, HARD_BANS);
  }
}

if (findings.length > 0) {
  console.error("MCP_PUBLIC_SAFE_BROKEN");
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `MCP_PUBLIC_SAFE_OK (${srcCount} src + ${testCount} test files clean — no private-handle/mirror-path/provenance leak)`,
);
