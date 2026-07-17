/**
 * check:skill-tool-refs — keeps every HISS agent skill honest about the public
 * MCP tool surface.
 *
 * The canonical MCP tool set is GENERATED FROM SOURCE
 * (`packages/mcp-server/src/tools.ts`, via `scripts/canonical/mcp-registry.ts`).
 * This guard then:
 *
 *   1. loads the canonical registry,
 *   2. scans every `skills/*&#47;SKILL.md`,
 *   3. validates each skill's structured `required_mcp_tools` frontmatter,
 *   4. checks every `hiss_*` identifier in the body against the registry and a
 *      reviewed allowlist of non-MCP tokens (`scripts/canonical/non-mcp-tokens.json`),
 *   5. fails on unknown tool names, HTTP routes / legacy names presented as MCP
 *      tools, and private/internal tool references,
 *   6. asserts the MCP tool count stated in the README and docs matches the
 *      registry — so the number can never be hardcoded out of sync.
 *
 * It is deliberately NOT a "every backtick is a tool" scanner: it keys on the
 * `hiss_` snake_case tool namespace and on explicit MCP-context labelling, and
 * it uses structured skill metadata as the primary contract.
 *
 * Exit 1 on any violation, printing file, line, the offending name, and the
 * closest canonical match.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";
import { loadCanonicalRegistry, closestTool } from "./canonical/mcp-registry.ts";

interface Allowlist {
  documentationLabels: Record<string, string>;
  legacyAliases: Record<string, string>;
  httpApi: Record<string, string>;
  privateInternal: Record<string, string>;
}

interface Violation {
  file: string;
  line: number;
  name: string;
  kind: string;
  detail: string;
}

const TOKEN_RE = /hiss_[a-z0-9_]+/g;
const HEADING_RE = /^#{1,6}\s+(.*)$/;
/** A line that presents a `hiss_*` token as an MCP tool. */
const MCP_LABEL_LINE_RE = /\bMCP\b[^`]*`hiss_/i;
const MCP_HEADING_RE = /mcp\s+tool/i;

/** Count claims that MUST equal the registry count. */
const COUNT_FILES = [
  "README.md",
  "docs/mcp.md",
  "docs/agent-skills.md",
  "docs/architecture.md",
  "docs/glossary.md",
  "CHANGELOG.md",
  "ROADMAP.md",
  "skills/hiss-mcp/SKILL.md",
];
const COUNT_RES: RegExp[] = [
  /(\d+)\s+read\/prepare\s+tools/gi,
  /exposing\s+(?:\*\*)?(\d+)(?:\*\*)?\s+read\/prepare/gi,
  /registers?\s+\*\*(\d+)\s+tools\*\*/gi,
  /##\s+The\s+(\d+)\s+tools/gi,
  /(\d+)\s+tools\s*\(\s*\d+\s+read/gi,
  /\*\*(\d+)\*\*\s+tools\s*\(\s*\d+\s+read/gi,
  /(\d+)\s+read\/prepare\s+MCP\s+tools/gi,
];

function loadAllowlist(): Allowlist {
  const p = join(REPO_ROOT, "scripts/canonical/non-mcp-tokens.json");
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return {
    documentationLabels: raw.documentationLabels ?? {},
    legacyAliases: raw.legacyAliases ?? {},
    httpApi: raw.httpApi ?? {},
    privateInternal: raw.privateInternal ?? {},
  };
}

/** Parse the `required_mcp_tools:` list out of a SKILL.md YAML frontmatter. */
function parseRequiredTools(lines: string[]): { tools: string[]; line: number } | null {
  if (lines[0]?.trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^required_mcp_tools:\s*(.*)$/);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith("[")) {
      const inner = inline.replace(/^\[|\]$/g, "").trim();
      const tools = inner
        ? inner
            .split(",")
            .map((s) => s.trim().replace(/['"]/g, ""))
            .filter(Boolean)
        : [];
      return { tools, line: i + 1 };
    }
    const tools: string[] = [];
    for (let j = i + 1; j < end; j++) {
      const item = lines[j].match(/^\s+-\s+(\S+)/);
      if (!item) break;
      tools.push(item[1].replace(/['"]/g, ""));
    }
    return { tools, line: i + 1 };
  }
  return null;
}

function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === "---") return i;
  return 0;
}

function main(): void {
  const reg = loadCanonicalRegistry();
  const allow = loadAllowlist();
  const violations: Violation[] = [];

  const skillFiles = listFiles(join(REPO_ROOT, "skills"), { textOnly: true }).filter((f) =>
    f.toLowerCase().endsWith("skill.md"),
  );
  const skillSet = new Set(skillFiles);
  // Also scan public docs + README for MCP-tool references, EXCEPT the migration
  // doc, which legitimately lists legacy names as documentation.
  const docFiles = [
    join(REPO_ROOT, "README.md"),
    ...listFiles(join(REPO_ROOT, "docs"), { textOnly: true }).filter(
      (f) => f.toLowerCase().endsWith(".md") && !f.endsWith("tool-name-migration.md"),
    ),
  ];
  const scanFiles = [...skillFiles, ...docFiles];

  let skillsScanned = 0;
  let referencedCanonical = 0;

  for (const file of scanFiles) {
    const r = rel(file);
    const lines = readLines(file);
    const isSkill = skillSet.has(file);
    if (isSkill) skillsScanned++;

    // (3) structured required_mcp_tools must all be canonical (skills only).
    const required = isSkill ? parseRequiredTools(lines) : null;
    if (required) {
      for (const t of required.tools) {
        if (!reg.set.has(t)) {
          const hint = closestTool(t, reg.tools);
          violations.push({
            file: r,
            line: required.line,
            name: t,
            kind: "required-not-canonical",
            detail: `required_mcp_tools declares "${t}" which is not a canonical MCP tool${hint ? ` (did you mean ${hint}?)` : ""}`,
          });
        }
      }
    }

    // (4-5) body scan.
    const start = frontmatterEnd(lines);
    let heading = "";
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      const hm = line.match(HEADING_RE);
      if (hm) heading = hm[1];
      const mcpContext = MCP_HEADING_RE.test(heading) || MCP_LABEL_LINE_RE.test(line);
      for (const m of line.matchAll(TOKEN_RE)) {
        const name = m[0];
        if (reg.set.has(name)) {
          referencedCanonical++;
          continue;
        }
        if (name in allow.documentationLabels) continue; // labels are prose, not tools
        if (name in allow.privateInternal) {
          violations.push({
            file: r,
            line: i + 1,
            name,
            kind: "private-internal",
            detail: `"${name}" is a private/internal tool and must not be referenced in a public skill`,
          });
          continue;
        }
        if (name in allow.legacyAliases) {
          violations.push({
            file: r,
            line: i + 1,
            name,
            kind: mcpContext ? "http-as-mcp" : "legacy-alias",
            detail: `legacy tool name "${name}" — use canonical "${allow.legacyAliases[name]}"`,
          });
          continue;
        }
        if (name in allow.httpApi) {
          violations.push({
            file: r,
            line: i + 1,
            name,
            kind: "http-as-mcp",
            detail: `"${name}" is an HTTP API capability (${allow.httpApi[name]}), not an MCP tool — reference the HTTP route or a canonical MCP tool, do not present it as an MCP tool`,
          });
          continue;
        }
        const hint = closestTool(name, reg.tools);
        violations.push({
          file: r,
          line: i + 1,
          name,
          kind: "unknown",
          detail: `unknown MCP tool "${name}"${hint ? ` (did you mean ${hint}?)` : ""}`,
        });
      }
    }
  }

  // (6) count assertions.
  const countProblems: { file: string; line: number; found: number }[] = [];
  let countClaims = 0;
  for (const rf of COUNT_FILES) {
    const abs = join(REPO_ROOT, rf);
    let lines: string[];
    try {
      lines = readLines(abs);
    } catch {
      continue;
    }
    for (let i = 0; i < lines.length; i++) {
      for (const re of COUNT_RES) {
        for (const m of lines[i].matchAll(re)) {
          countClaims++;
          const n = Number(m[1]);
          if (n !== reg.count) countProblems.push({ file: rf, line: i + 1, found: n });
        }
      }
    }
  }

  // Report.
  const byKind = (k: string) => violations.filter((v) => v.kind === k).length;
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.detail}`);
  }
  for (const c of countProblems) {
    console.error(
      `  ${c.file}:${c.line}  [count-drift]  states ${c.found} MCP tools but the registry has ${reg.count}`,
    );
  }

  console.log(`CANONICAL_MCP_TOOL_COUNT=${reg.count}`);
  console.log(`SKILLS_SCANNED=${skillsScanned}  CANONICAL_TOOL_REFERENCES=${referencedCanonical}`);
  console.log(`UNKNOWN_SKILL_TOOL_REFERENCES=${byKind("unknown")}`);
  console.log(`HTTP_AS_MCP_MISLABELS=${byKind("http-as-mcp")}`);
  console.log(`LEGACY_ALIAS_REFERENCES=${byKind("legacy-alias")}`);
  console.log(`PRIVATE_TOOL_REFERENCES=${byKind("private-internal")}`);
  console.log(`REQUIRED_NOT_CANONICAL=${byKind("required-not-canonical")}`);
  console.log(`MCP_COUNT_CLAIMS_CHECKED=${countClaims}  COUNT_DRIFT=${countProblems.length}`);

  if (countClaims < 2) {
    console.error(
      "  check:skill-tool-refs — expected at least 2 MCP tool-count claims (README + docs/mcp.md); found fewer.",
    );
  }

  const failed = violations.length > 0 || countProblems.length > 0 || countClaims < 2;
  if (failed) {
    console.error(
      `check:skill-tool-refs FAILED — ${violations.length} reference violation(s), ${countProblems.length} count drift(s).`,
    );
    process.exit(1);
  }
  console.log("check:skill-tool-refs OK — all skill tool references match the canonical MCP registry.");
}

main();
