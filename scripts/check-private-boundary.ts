/**
 * check:private-boundary — the hard boundary between this PUBLIC repository and
 * the private HISS monorepo / operator infrastructure.
 *
 * Scans every tracked text file in the repo (excluding .git, node_modules,
 * build outputs) for strings that must never appear in public source:
 *   - the private author/handle and their private GitHub namespace
 *   - private local filesystem paths
 *   - private planning / handoff artifact names
 *   - production secret ENV NAMES (values are caught by check:secrets)
 *   - keyed Alchemy RPC URLs
 *   - private/admin HISS API routes
 *
 * The forbidden needles are assembled from fragments at runtime so that THIS
 * scanner (and every other guard) can itself be scanned without self-tripping.
 *
 * Exit 1 and print each offending file:line on any hit.
 */
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

interface Rule {
  id: string;
  /** Human explanation of why this is forbidden. */
  why: string;
  test: RegExp;
}

// --- Needle fragments (kept split so the literals never appear verbatim) ---
const HANDLE = "Melted" + "Mindz";
const USER_PATH = "/Users/" + "melted/";
const GH_HOST = "github.com/";

/**
 * Match an UPPER_SNAKE env-var NAME as a whole token — preceded/followed by a
 * non-identifier char — so defensive code that names identifiers like
 * `PRIVATE_KEY_VALUE_RE` (a credential *rejecter*) is not a false positive,
 * while a real `process.env.PRIVATE_KEY` leak still trips.
 */
function envNameRe(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`);
}

/** Match a leaked env-var PREFIX followed by more of an UPPER_SNAKE name. */
function envPrefixRe(prefix: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9_])${prefix}[A-Z0-9]`);
}

const RULES: Rule[] = [
  {
    id: "private-handle",
    why: "private author handle must not appear in public source",
    test: new RegExp(HANDLE, "i"),
  },
  {
    id: "private-github-namespace",
    why: "private GitHub namespace must not be referenced",
    test: new RegExp(escapeRe(GH_HOST + HANDLE), "i"),
  },
  {
    id: "private-local-path",
    why: "private local filesystem path leaks operator machine layout",
    test: new RegExp(escapeRe(USER_PATH)),
  },
  {
    id: "planning-artifact",
    why: "private planning artifact name",
    test: new RegExp("task" + "_" + "plan", "i"),
  },
  {
    id: "handoff-artifact",
    why: "private handoff artifact path",
    test: new RegExp(escapeRe("artifacts/" + "handoffs")),
  },
  {
    id: "secret-env-bankr",
    why: "production secret ENV name",
    test: envNameRe("BANKR" + "_API" + "_KEY"),
  },
  {
    id: "secret-env-vercel",
    why: "production secret ENV name",
    test: envNameRe("VERCEL" + "_TOKEN"),
  },
  {
    id: "secret-env-database",
    why: "production secret ENV name",
    test: envNameRe("DATABASE" + "_URL"),
  },
  {
    id: "secret-env-neon",
    why: "managed-database ENV prefix",
    test: envPrefixRe("NEON" + "_"),
  },
  {
    id: "secret-env-private-key",
    why: "private-key ENV name",
    test: envNameRe("PRIVATE" + "_KEY"),
  },
  {
    id: "secret-env-seed-phrase",
    why: "wallet seed-phrase ENV name",
    test: envNameRe("SEED" + "_PHRASE"),
  },
  {
    id: "keyed-alchemy-url",
    why: "keyed Alchemy RPC URL embeds a private API key",
    test: /[a-z0-9-]+\.g\.alchemy\.com\/v2\/[A-Za-z0-9_-]{12,}/i,
  },
  {
    id: "private-hiss-admin-route",
    why: "private/admin HISS API route",
    test: /\/api\/(admin|internal|operator|_)\//i,
  },
];

/** Files that are ALLOWED to describe the boundary (they define the rules). */
const SELF = new Set<string>(["scripts/check-private-boundary.ts"]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main(): void {
  const files = listFiles(REPO_ROOT, { textOnly: true });
  const hits: { file: string; line: number; id: string; why: string; text: string }[] = [];

  for (const file of files) {
    const r = rel(file);
    if (SELF.has(r)) continue; // this file constructs the needles by design
    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of RULES) {
        if (rule.test.test(line)) {
          hits.push({ file: r, line: i + 1, id: rule.id, why: rule.why, text: line.trim().slice(0, 160) });
        }
      }
    }
  }

  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.id}] ${h.why}\n    > ${h.text}`);
  }
  console.log(`PRIVATE_BOUNDARY_ACTIVE_HITS=${hits.length}`);
  if (hits.length > 0) {
    console.error(`\ncheck:private-boundary FAILED — ${hits.length} forbidden reference(s) found.`);
    process.exit(1);
  }
  console.log("check:private-boundary OK — no private references found.");
}

main();
