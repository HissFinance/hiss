/**
 * `hiss coil validate|compile` — local, deterministic CoilOps playbook
 * validation and compilation. No network, no keys, no execution rail.
 */

import { readFile } from "node:fs/promises";
import type { CommandResult } from "../lib/output.js";
import { assertNoCredentials } from "../lib/credentials.js";
import { compileCoil, validateCoil, CoilCompileError } from "../lib/coil.js";

async function loadJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function coilValidateCommand(manifestPath: string): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  const verdict = validateCoil(manifest);
  const detail = verdict.ok
    ? ["Coil manifest is valid: universe, rules, and mandatory risk fuses are present."]
    : verdict.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`);
  return {
    summary: verdict.ok
      ? `Coil manifest VALID (${verdict.schema}).`
      : `Coil manifest INVALID: ${verdict.issues.length} issue(s).`,
    data: verdict,
    detail,
  };
}

export async function coilCompileCommand(manifestPath: string, nowIso?: string): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  try {
    const compiled = compileCoil(manifest, nowIso);
    return {
      summary: `Compiled coil "${compiled.name}" — hash ${compiled.coilHash}. This is a plan, not an executed order.`,
      data: compiled,
      detail: [
        `Universe: ${compiled.universe.length} instrument(s)`,
        `Rules: ${compiled.ruleCount}`,
        "Risk fuses are binding and may never be bypassed. Nothing was executed.",
      ],
    };
  } catch (err) {
    if (err instanceof CoilCompileError) {
      return {
        summary: `Refusing to compile: coil manifest INVALID (${err.issues.length} issue(s)).`,
        data: { ok: false, issues: err.issues },
        detail: err.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`),
      };
    }
    throw err;
  }
}
