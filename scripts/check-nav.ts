/**
 * check:nav — README navigability guard.
 *
 * The README is the front door: everything must track through it. This guard
 * fails when a sync adds content but does not cascade the navigation up to
 * README.md, so nothing gets orphaned. It checks:
 *
 *   1. REACHABILITY — every `docs/**\/*.md` page and every `skills/*\/SKILL.md`
 *      is reachable from README.md by following relative Markdown links
 *      (README -> Documentation map -> section index.md -> leaf, plus any
 *      cross-links). Broken links are docs:check's job; this is about orphans.
 *   2. SKILL COUNT — the "<N> agent skills" wording in README matches the real
 *      number of `skills/*\/SKILL.md` packs.
 *
 * Deliberate exceptions go in ALLOWLIST with a reason. Exit 1 on any orphan or
 * count mismatch, printing exactly what is unreachable so the fix is obvious.
 */
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

const LINK_RE = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const EXTERNAL_RE = /^(https?:|mailto:|tel:|ftp:|data:|#)/i;

/** repo-relative paths intentionally NOT required in the README nav graph. */
const ALLOWLIST = new Set<string>([
  // none today — add with a one-line reason if a doc is deliberately unlinked.
]);

const isMarkdown = (p: string): boolean => {
  const s = p.toLowerCase();
  return s.endsWith(".md") || s.endsWith(".mdx") || s.endsWith(".markdown");
};

const isSkillPack = (r: string): boolean => /^skills\/[^/]+\/SKILL\.md$/.test(r);
const isRequiredDoc = (r: string): boolean => r.startsWith("docs/") && isMarkdown(r);

/** Resolve a Markdown link target to an absolute path, or null if not a local .md. */
function resolveMdTarget(baseDir: string, raw: string): string | null {
  if (!raw || EXTERNAL_RE.test(raw)) return null;
  const targetPath = raw.split("#")[0].split("?")[0];
  if (!targetPath) return null;
  const abs = targetPath.startsWith("/")
    ? join(REPO_ROOT, targetPath.slice(1))
    : resolve(baseDir, targetPath);
  return isMarkdown(abs) ? abs : null;
}

function main(): void {
  const allMd = listFiles(REPO_ROOT, { textOnly: true }).filter(isMarkdown);
  const readme = join(REPO_ROOT, "README.md");
  if (!existsSync(readme)) {
    console.error("check:nav FAILED — README.md not found at repo root.");
    process.exit(1);
  }

  // BFS the Markdown link graph starting at README.md.
  const reachable = new Set<string>([readme]);
  const queue: string[] = [readme];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const baseDir = dirname(cur);
    for (const line of readLines(cur)) {
      for (const m of line.matchAll(LINK_RE)) {
        const abs = resolveMdTarget(baseDir, m[1].trim());
        if (!abs || !existsSync(abs) || reachable.has(abs)) continue;
        reachable.add(abs);
        queue.push(abs);
      }
    }
  }

  // Required-reachable set: every docs page + every skill pack (minus allowlist).
  const required = allMd.filter((f) => {
    const r = rel(f);
    if (ALLOWLIST.has(r)) return false;
    return isRequiredDoc(r) || isSkillPack(r);
  });
  const orphans = required
    .filter((f) => !reachable.has(f))
    .map(rel)
    .sort();

  // Skill-count wording must match the real number of packs.
  const skillCount = allMd.map(rel).filter(isSkillPack).length;
  const readmeText = readLines(readme).join("\n");
  const countPhrase = /(\d+)\s+agent skills/i.exec(readmeText);
  const declaredCount = countPhrase ? Number(countPhrase[1]) : null;

  let failed = false;

  if (orphans.length > 0) {
    failed = true;
    console.error(`check:nav — ${orphans.length} page(s) are NOT reachable from README.md (orphaned nav):`);
    for (const o of orphans) {
      const where = isSkillPack(o) ? "skill pack" : "doc";
      console.error(`  ${o}  (${where}) — link it from README, its section index, or the doc map`);
    }
  }

  if (declaredCount === null) {
    failed = true;
    console.error(`check:nav — README.md has no "<N> agent skills" count wording to verify.`);
  } else if (declaredCount !== skillCount) {
    failed = true;
    console.error(
      `check:nav — README says "${declaredCount} agent skills" but there are ${skillCount} skill packs. Update the count + catalog.`,
    );
  }

  console.log(
    `NAV_REACHABLE=${reachable.size}  DOCS+SKILLS_REQUIRED=${required.length}  SKILL_PACKS=${skillCount}  DECLARED=${declaredCount ?? "none"}`,
  );

  if (failed) {
    console.error(
      "\ncheck:nav FAILED — README navigability incomplete. Everything must track through the README (see the sync checklist).",
    );
    process.exit(1);
  }
  console.log("check:nav OK — every doc + skill is reachable from README and the skill count matches.");
}

main();
