/**
 * `hiss skill list|print` — surface the repo's agent skill packs. Skill packs
 * are directories under a `skills/` root, each containing a `SKILL.md`. The
 * root is resolved from `HISS_SKILLS_DIR`, else by walking up from the current
 * directory. Missing packs are reported honestly, never fabricated.
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CommandResult } from "../lib/output.js";

/** Resolve the skills root directory, or null if none is found. */
export function resolveSkillsDir(startDir = process.cwd()): string | null {
  const fromEnv = process.env.HISS_SKILLS_DIR;
  if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv);
  let dir = startDir;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, "skills");
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function listSkillPacks(root: string): string[] {
  return readdirSync(root)
    .filter((name) => {
      const dir = join(root, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
    })
    .sort();
}

export function skillListCommand(startDir = process.cwd()): CommandResult {
  const root = resolveSkillsDir(startDir);
  if (!root) {
    return {
      summary: "No skills directory found (set HISS_SKILLS_DIR or run from the monorepo).",
      data: { skills: [], skillsDir: null },
    };
  }
  const skills = listSkillPacks(root);
  return {
    summary: `${skills.length} skill pack${skills.length === 1 ? "" : "s"} found.`,
    data: { skills, skillsDir: root },
    detail: skills,
  };
}

export function skillPrintCommand(name: string, startDir = process.cwd()): CommandResult {
  const root = resolveSkillsDir(startDir);
  if (!root) {
    return {
      summary: "No skills directory found (set HISS_SKILLS_DIR or run from the monorepo).",
      data: { skill: name, found: false },
    };
  }
  const file = join(root, name, "SKILL.md");
  if (!existsSync(file)) {
    return {
      summary: `Skill pack "${name}" not found.`,
      data: { skill: name, found: false, skillsDir: root },
    };
  }
  const content = readFileSync(file, "utf8");
  return {
    summary: `Skill pack "${name}" (${content.length} bytes).`,
    data: { skill: name, found: true, content },
    detail: [content],
  };
}
