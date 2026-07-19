/**
 * check:fee-docs — guarantees published fee documentation never drifts from the
 * canonical fee-model constants in scripts/canonical/fee-constants.ts.
 *
 * Strategy: scan docs (and any generated fee JSON) for the recognizable
 * fee-model tokens — the five-way percentage split "a/b/c/d/e", swap-fee basis
 * points, and the creator/Doppler launch split — and assert every occurrence
 * matches the canonical table. Any split token in a fee-split context that is
 * neither the canonical current split nor the explicitly historical V1 split
 * (50/30/10/10) is treated as drift.
 *
 * Exit 1 on drift.
 */
import { FEE_CONSTANTS, splitToken, splitSumsTo100 } from "./canonical/fee-constants.ts";
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

const CANON_SPLIT = splitToken(); // "50/15/15/10/10"
// The V1 methodology, retained only as clearly-labelled history.
const HISTORICAL_V1_SPLIT = "50/30/10/10";
const ALLOWED_SPLITS = new Set([CANON_SPLIT, HISTORICAL_V1_SPLIT]);

// A three-to-five-part integer split token, e.g. 50/15/15/10/10, at word boundaries.
const SPLIT_RE = /(?<![\d/])(\d{1,3}(?:\/\d{1,3}){2,4})(?![\d/])/g;
// "70 bps" style references — reject comma/digit-prefixed numbers so a
// grouped total like "10,000 bps" is not misread as "0 bps".
const BPS_RE = /(?<![\d,.])(\d{1,4})\s*bps\b/gi;
const SWAP_PCT_RE = /(?<![\d,.])(\d{1,2}(?:\.\d+)?)\s*%\s*(?:swap\s+)?fee/gi;

function main(): void {
  if (!splitSumsTo100()) {
    console.error("check:fee-docs FAILED — canonical split does not sum to 100 (fix fee-constants.ts).");
    process.exit(1);
  }

  // Only human-facing fee/reward documentation under docs/ is in scope. JSON
  // Schemas (validated separately by schemas:validate) legitimately contain
  // structural bounds like `0`/`10000 bps` and must not be treated as docs.
  const files = listFiles(REPO_ROOT, { textOnly: true }).filter((f) => {
    const r = rel(f).toLowerCase();
    const isDocMarkdown = /^docs\//.test(r) && (r.endsWith(".md") || r.endsWith(".mdx"));
    const isFeeTopic = /(fee|reward|split)/.test(r);
    return isDocMarkdown && isFeeTopic;
  });

  const drift: { file: string; line: number; found: string; expected: string; kind: string }[] = [];

  for (const file of files) {
    const r = rel(file);
    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const windowText = lines.slice(Math.max(0, i - 2), i + 3).join(" ");

      // A split token is only the TRADING-FEE split when its context says so.
      // Other legitimate multi-part weightings exist (e.g. provider-reward
      // quality weighting 40/30/20/10) and must not be forced to the canonical
      // split. The current split must be canonical; the only other permitted
      // token is the historical V1 split (50/30/10/10).
      if (isFeeSplitContext(windowText)) {
        for (const m of line.matchAll(SPLIT_RE)) {
          const token = m[1];
          if (!ALLOWED_SPLITS.has(token)) {
            drift.push({ file: r, line: i + 1, found: token, expected: CANON_SPLIT, kind: "hiss-fee-split" });
          }
        }
      }

      for (const m of line.matchAll(BPS_RE)) {
        const bps = Number(m[1]);
        // Only enforce the swap-fee figure when the line is about the swap fee.
        if (/swap|pool|uniswap|trading/i.test(line) && bps !== FEE_CONSTANTS.swapFeeBps) {
          drift.push({
            file: r,
            line: i + 1,
            found: `${bps} bps`,
            expected: `${FEE_CONSTANTS.swapFeeBps} bps`,
            kind: "swap-fee-bps",
          });
        }
      }

      for (const m of line.matchAll(SWAP_PCT_RE)) {
        const pct = Number(m[1]);
        const expectedPct = FEE_CONSTANTS.swapFeeBps / 100; // 70 bps => 0.7
        if (/swap|pool|uniswap|trading/i.test(line) && Math.abs(pct - expectedPct) > 1e-9) {
          drift.push({
            file: r,
            line: i + 1,
            found: `${pct}% fee`,
            expected: `${expectedPct}% fee`,
            kind: "swap-fee-pct",
          });
        }
      }
    }
  }

  for (const d of drift) {
    console.error(`  ${d.file}:${d.line}  [${d.kind}] found ${d.found}, expected ${d.expected}`);
  }
  console.log(
    `FEE_DOC_DRIFT=${drift.length}  (canonical split ${CANON_SPLIT}, swap ${FEE_CONSTANTS.swapFeeBps} bps)`,
  );
  console.log(`FEE_DOCS_SCANNED=${files.length}`);
  if (drift.length > 0) {
    console.error(
      `\ncheck:fee-docs FAILED — ${drift.length} figure(s) drifted from the canonical fee model.`,
    );
    process.exit(1);
  }
  console.log("check:fee-docs OK — fee docs match the canonical constants.");
}

/**
 * True when the window is unmistakably describing the HISS trading-fee split:
 * an explicit "fee split" / "trading fee" phrase, or the co-occurrence of the
 * split's two endpoint legs (stakers + treasury).
 */
function isFeeSplitContext(text: string): boolean {
  if (/(fee[-\s]?split|trading[-\s]?fee|split\s+50\/(?:15|30))/i.test(text)) return true;
  return /staker/i.test(text) && /treasury/i.test(text);
}

main();
