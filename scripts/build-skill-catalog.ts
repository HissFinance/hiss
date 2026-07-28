/**
 * skills:catalog / check:skill-catalog — the machine-readable skill catalog,
 * generated deterministically from the SKILL.md frontmatter.
 *
 * `skills/skill-catalog.json` must be EXACTLY what regenerating it from the
 * `skills/<pack>/SKILL.md` frontmatter would produce — catalog == frontmatter,
 * byte-for-byte. Rows are sorted by name, arrays are de-duplicated and sorted,
 * output is 2-space JSON with a trailing newline.
 *
 * Capability encoding (schema 1.1.0): optional capability families live in the
 * dedicated `optional_capability_families` list. The legacy trailing-`?`
 * encoding inside `required_capability_families` (e.g. `equities?`) broke
 * strict/installer YAML flow sequences; this generator still READS the legacy
 * form (tolerant normalizer) but always EMITS the canonical split, and the
 * check mode fails when a frontmatter file still uses the legacy form.
 *
 * Usage:
 *   tsx scripts/build-skill-catalog.ts          # regenerate the catalog
 *   tsx scripts/build-skill-catalog.ts --check  # verify catalog == frontmatter
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import * as prettier from "prettier";
import { REPO_ROOT } from "./lib/walk.ts";

const SKILLS_DIR = join(REPO_ROOT, "skills");
const CATALOG_PATH = join(SKILLS_DIR, "skill-catalog.json");

// ---------------------------------------------------------------------------
// Minimal deterministic frontmatter reader (no YAML dependency).
// Supports exactly the constructs the skill packs use:
//   - plain scalars            `version: 3`
//   - inline flow lists        `tags: [a, b]`
//   - wrapped flow lists       `field:\n  [a, b]`
//   - block lists              `field:\n  - a\n  - b`
//   - folded block scalars     `description: >-\n  line…\n  line…`
//   - nested maps (`metadata:` and children) are ignored for the catalog.
// ---------------------------------------------------------------------------

type Frontmatter = Record<string, unknown>;

function parseFlowList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (inner.trim() === "") return [];
  return inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
}

function parseScalar(raw: string): unknown {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  return t.replace(/^["']|["']$/g, "");
}

export function parseFrontmatter(source: string): Frontmatter {
  const lines = source.split(/\r?\n/);
  if (lines[0] !== "---") return {};
  const end = lines.indexOf("---", 1);
  if (end < 0) return {};
  const fm = lines.slice(1, end);
  const data: Frontmatter = {};

  let i = 0;
  while (i < fm.length) {
    const line = fm[i];
    if (line.trim() === "" || line.startsWith("#")) {
      i++;
      continue;
    }
    // Nested content under a previous key (e.g. metadata children) — handled
    // by the key branch below; a stray indented line here is skipped.
    if (/^\s/.test(line)) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];

    if (rest === ">-" || rest === ">" || rest === "|" || rest === "|-") {
      // Block scalar: consume the following indented lines; fold with spaces.
      const parts: string[] = [];
      i++;
      while (i < fm.length && (/^\s+\S/.test(fm[i]) || fm[i].trim() === "")) {
        if (fm[i].trim() !== "") parts.push(fm[i].trim());
        i++;
      }
      data[key] = parts.join(" ");
      continue;
    }

    if (rest === "") {
      // Wrapped flow list, block list, or nested map on the following lines.
      const block: string[] = [];
      i++;
      while (i < fm.length && (/^\s/.test(fm[i]) || fm[i].trim() === "")) {
        if (fm[i].trim() !== "") block.push(fm[i]);
        i++;
      }
      const joined = block.map((l) => l.trim()).join(" ");
      if (joined.startsWith("[")) {
        data[key] = parseFlowList(joined);
      } else if (block.every((l) => l.trim().startsWith("- "))) {
        data[key] = block.map((l) =>
          l
            .trim()
            .slice(2)
            .trim()
            .replace(/^["']|["']$/g, ""),
        );
      }
      // Nested maps (metadata) are intentionally not represented in the catalog.
      continue;
    }

    if (rest.startsWith("[")) {
      data[key] = parseFlowList(rest);
      i++;
      continue;
    }

    data[key] = parseScalar(rest);
    i++;
    continue;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Catalog construction
// ---------------------------------------------------------------------------

const uniqSorted = (xs: string[]): string[] => [...new Set(xs)].sort();

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Tolerant capability normalizer: reads BOTH the canonical form
 * (`required_capability_families` + `optional_capability_families`) and the
 * legacy trailing-`?` form, and emits only the canonical split.
 */
function normalizeCapabilityFamilies(d: Frontmatter): {
  required: string[];
  optional: string[];
  legacyMarkers: string[];
} {
  const required: string[] = [];
  const optional: string[] = [];
  const legacyMarkers: string[] = [];
  for (const raw of asStringArray(d.required_capability_families)) {
    if (raw.endsWith("?")) {
      legacyMarkers.push(raw);
      optional.push(raw.slice(0, -1));
    } else {
      required.push(raw);
    }
  }
  for (const raw of asStringArray(d.optional_capability_families)) {
    optional.push(raw.endsWith("?") ? raw.slice(0, -1) : raw);
  }
  return { required: uniqSorted(required), optional: uniqSorted(optional), legacyMarkers };
}

interface CatalogRow {
  name: string;
  version: number;
  visibility: string;
  description: string;
  required_hiss_skills: string[];
  required_mcp_servers: string[];
  required_mcp_tools: string[];
  required_capability_families: string[];
  optional_capability_families: string[];
  local_only_data: boolean | null;
  write_risk: string | null;
  runtime_requirement: string | null;
}

function listSkillPacks(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter((name) => {
      const dir = join(SKILLS_DIR, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
    })
    .sort();
}

async function buildCatalog(): Promise<{ json: string; legacy: string[] }> {
  const legacy: string[] = [];
  const rows: CatalogRow[] = listSkillPacks().map((pack) => {
    const d = parseFrontmatter(readFileSync(join(SKILLS_DIR, pack, "SKILL.md"), "utf8"));
    const caps = normalizeCapabilityFamilies(d);
    for (const marker of caps.legacyMarkers) {
      legacy.push(`skills/${pack}/SKILL.md — legacy optional marker "${marker}"`);
    }
    return {
      name: typeof d.name === "string" ? d.name : pack,
      version: typeof d.version === "number" ? d.version : 0,
      visibility: typeof d.visibility === "string" ? d.visibility : "unknown",
      description: typeof d.description === "string" ? d.description : "",
      required_hiss_skills: uniqSorted(asStringArray(d.required_hiss_skills)),
      required_mcp_servers: uniqSorted(asStringArray(d.required_mcp_servers)),
      required_mcp_tools: uniqSorted(asStringArray(d.required_mcp_tools)),
      required_capability_families: caps.required,
      optional_capability_families: caps.optional,
      local_only_data: typeof d.local_only_data === "boolean" ? d.local_only_data : null,
      write_risk: typeof d.write_risk === "string" ? d.write_risk : null,
      runtime_requirement: typeof d.runtime_requirement === "string" ? d.runtime_requirement : null,
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const families = uniqSorted(
    rows.flatMap((r) => [...r.required_capability_families, ...r.optional_capability_families]),
  );

  const catalog = {
    schemaVersion: "hiss-skill-catalog-1.1.0",
    generatedBy: "scripts/build-skill-catalog.ts — public skill frontmatter (HissFinance/hiss)",
    capabilityFamilies: families,
    skills: rows,
  };
  // Serialize through the repo's own prettier config so the committed catalog
  // is simultaneously byte-stable for this check AND `format:check`-clean.
  const raw = JSON.stringify(catalog, null, 2) + "\n";
  const config = (await prettier.resolveConfig(CATALOG_PATH)) ?? {};
  const json = await prettier.format(raw, { ...config, parser: "json" });
  return { json, legacy };
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const { json, legacy } = await buildCatalog();

  if (legacy.length > 0) {
    console.error("check:skill-catalog — legacy `?` capability encoding found in frontmatter:");
    for (const l of legacy) console.error(`  - ${l}`);
    console.error("Move optional families to `optional_capability_families` and regenerate.");
    process.exit(1);
  }

  if (check) {
    const current = existsSync(CATALOG_PATH) ? readFileSync(CATALOG_PATH, "utf8") : "";
    if (current !== json) {
      console.error(
        "check:skill-catalog FAILED — skills/skill-catalog.json is out of sync with the SKILL.md " +
          "frontmatter. Run `pnpm skills:catalog` to regenerate.",
      );
      process.exit(1);
    }
    const count = (JSON.parse(json) as { skills: unknown[] }).skills.length;
    console.log(`check:skill-catalog OK — catalog matches ${count} skill packs' frontmatter exactly.`);
    return;
  }

  writeFileSync(CATALOG_PATH, json);
  const count = (JSON.parse(json) as { skills: unknown[] }).skills.length;
  console.log(`skills:catalog — wrote skills/skill-catalog.json (${count} packs).`);
}

await main();
