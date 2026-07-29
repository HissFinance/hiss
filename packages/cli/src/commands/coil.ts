/**
 * `hiss coil validate|compile` — local, deterministic CoilOps playbook
 * validation and compilation. No network, no keys, no execution rail.
 */

import { readFile } from "node:fs/promises";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { ViewBlock } from "../lib/view.js";
import { assertNoCredentials } from "../lib/credentials.js";
import { compileCoil, validateCoil, CoilCompileError, REQUIRED_COIL_FUSES } from "../lib/coil.js";
import type { ValidationIssue } from "../lib/validate.js";

async function loadJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

function issueTable(title: string, issues: ValidationIssue[]): ViewBlock {
  return {
    kind: "table",
    title,
    columns: [{ header: "Code" }, { header: "Path" }, { header: "Message" }],
    rows: issues.map((i) => [{ value: i.code, token: "error" as const }, i.path || "(root)", i.message]),
  };
}

export async function coilValidateCommand(manifestPath: string): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  const verdict = validateCoil(manifest);
  const detail = verdict.ok
    ? ["Coil manifest is valid: universe, rules, and mandatory risk fuses are present."]
    : verdict.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`);
  const view: ViewBlock[] = verdict.ok
    ? [
        { kind: "status", state: "success", label: "VALID", note: verdict.schema },
        {
          kind: "panel",
          variant: "success",
          lines: [
            `Universe, rules, and mandatory risk fuses (${REQUIRED_COIL_FUSES.join(", ")}) are present.`,
          ],
        },
      ]
    : [
        {
          kind: "status",
          state: "error",
          label: `INVALID — ${verdict.issues.length} issue(s)`,
          note: verdict.schema,
        },
        issueTable("Validation issues", verdict.issues),
      ];
  return {
    summary: verdict.ok
      ? `Coil manifest VALID (${verdict.schema}).`
      : `Coil manifest INVALID: ${verdict.issues.length} issue(s).`,
    data: verdict,
    detail,
    view,
    exitCode: verdict.ok ? EXIT.SUCCESS : EXIT.VERIFICATION,
  };
}

export async function coilCompileCommand(manifestPath: string, nowIso?: string): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  try {
    const compiled = compileCoil(manifest, nowIso);
    const fuseNames = Object.keys(compiled.fuses ?? {});
    const view: ViewBlock[] = [
      {
        kind: "keyValue",
        title: `Compiled coil "${compiled.name}"`,
        rows: [
          { label: "Identity", value: compiled.name, token: "value" },
          { label: "Schema", value: compiled.schema, token: "muted" },
          { label: "Universe", value: `${compiled.universe.length} instrument(s)`, token: "value" },
          { label: "Rules", value: compiled.ruleCount, token: "value" },
          { label: "Coil hash", value: compiled.coilHash, token: "hash", full: true },
          { label: "Execution", value: "plan only — no order", token: "prepared" },
        ],
      },
      {
        kind: "fuse",
        title: "Risk-fuse coverage",
        rows: REQUIRED_COIL_FUSES.map((f) => ({
          fuse: f,
          result: fuseNames.includes(f) ? ("pass" as const) : ("unknown" as const),
        })),
      },
      {
        kind: "panel",
        variant: "info",
        lines: [
          "This is a plan (a deterministic hash), not an order. Risk fuses are binding and may never be bypassed.",
        ],
      },
    ];
    return {
      summary: `Compiled coil "${compiled.name}" — hash ${compiled.coilHash}. This is a plan, not an executed order.`,
      data: compiled,
      detail: [
        `Universe: ${compiled.universe.length} instrument(s)`,
        `Rules: ${compiled.ruleCount}`,
        "Risk fuses are binding and may never be bypassed. Nothing was executed.",
      ],
      view,
      exitCode: EXIT.SUCCESS,
    };
  } catch (err) {
    if (err instanceof CoilCompileError) {
      return {
        summary: `Refusing to compile: coil manifest INVALID (${err.issues.length} issue(s)).`,
        data: { ok: false, issues: err.issues },
        detail: err.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`),
        view: [
          { kind: "status", state: "blocked", label: "REFUSED", note: "manifest INVALID — nothing compiled" },
          issueTable("Validation issues", err.issues),
        ],
        exitCode: EXIT.POLICY,
      };
    }
    throw err;
  }
}
