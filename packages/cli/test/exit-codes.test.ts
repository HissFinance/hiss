/**
 * §25 — Exit-code regression matrix (THE behavior change).
 *
 * BASELINE (from docs/cli/COMMAND_INVENTORY.md "Exit-code baseline"): before
 * this overhaul the CLI emitted only {0, 1} — every business fail-closed
 * outcome (validate INVALID, compile/prepare refusal, receipt FAILED, skill
 * not-found, lp unavailable) exited 0, and every thrown error exited 1. A
 * caller could not distinguish VALID from INVALID by exit status.
 *
 * TARGET (OUTPUT_CONTRACT §6): a stable taxonomy 0..7. This suite pins the new
 * per-command codes AND proves the rendered human/JSON TEXT is unchanged — only
 * the process code moved. Nothing collapses to 1.
 *
 * Determinism: a MOCK client (never live RPC), an injected mcp fetch, an
 * injected skills dir, and `onResult` (so the success path does not touch the
 * real stdout). Error paths render to process.stderr, which is silenced here.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { runCli, type BuildOptions } from "../src/cli.js";
import { EXIT, kindForCode, classifyCommanderError } from "../src/lib/exit.js";
import { renderResult } from "../src/lib/output.js";
import { vaultValidateCommand } from "../src/commands/vault.js";
import {
  mockClient,
  networkFailingClient,
  healthyMcpFetch,
  downMcpFetch,
  SKILLS_DIR,
  fixture,
  capture,
} from "./_helpers.js";
import type { FetchLike } from "../src/commands/mcp.js";

const VALID_RECEIPT = JSON.stringify({
  kind: "state-read",
  subject: "vault",
  note: "integrity fixture",
  hash: "0xcaf148cbe2e70fb008e653ca7ca3ffc46365e3f1a515f13f9cf31de081427975",
});
const FAILED_RECEIPT = JSON.stringify({ kind: "state-read", hash: "0xdeadbeef" });

/** Run the CLI hermetically and return only the exit code. */
async function code(argv: string[], extra: BuildOptions = {}): Promise<number> {
  return runCli(argv, {
    makeClient: () => mockClient(),
    onResult: () => {},
    skillDir: SKILLS_DIR,
    mcpFetch: healthyMcpFetch(),
    ...extra,
  });
}

// Silence the error-path renderer (writes to process.stderr) so the suite is quiet.
let errSpy: { mockRestore(): void };
let outSpy: { mockRestore(): void };
beforeAll(() => {
  errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  outSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterAll(() => {
  errSpy.mockRestore();
  outSpy.mockRestore();
});

describe("§25 baseline invariants", () => {
  it("the stable taxonomy is exactly 0..7 with the documented names", () => {
    expect(EXIT).toEqual({
      SUCCESS: 0,
      GENERAL: 1,
      USAGE: 2,
      CONFIG: 3,
      NETWORK: 4,
      POLICY: 5,
      VERIFICATION: 6,
      PARTIAL: 7,
    });
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(kindForCode)).toEqual([
      "success",
      "general",
      "usage",
      "config",
      "network",
      "policy",
      "verification",
      "partial",
    ]);
  });
});

describe("§25 SUCCESS → 0", () => {
  const zero: [string, string[]][] = [
    ["status", ["status"]],
    ["contracts", ["contracts"]],
    ["vault list", ["vault", "list"]],
    ["vault validate VALID", ["vault", "validate", fixture("vault.valid.json")]],
    [
      "vault prepare-deposit",
      [
        "vault",
        "prepare-deposit",
        "0x432e90b1B35995EBE46eD93B4Db369abfc230E69",
        "1000",
        "0x1111111111111111111111111111111111111111",
      ],
    ],
    ["coil validate VALID", ["coil", "validate", fixture("coil.valid.json")]],
    ["coil compile VALID", ["coil", "compile", fixture("coil.valid.json")]],
    ["receipt verify VERIFIED", ["receipt", "verify", VALID_RECEIPT]],
    ["stake status", ["stake", "status"]],
    ["rewards status", ["rewards", "status"]],
    ["lp status", ["lp", "status"]],
    ["agentic status", ["agentic", "status"]],
    ["skill list", ["skill", "list"]],
    ["skill print (existing)", ["skill", "print", "demo-pack"]],
    ["mcp status (healthy)", ["mcp", "status"]],
    ["mcp doctor (all pass)", ["mcp", "doctor"]],
  ];
  for (const [name, argv] of zero) {
    it(name, async () => expect(await code(argv)).toBe(EXIT.SUCCESS));
  }
});

describe("§25 USAGE → 2 (was 1)", () => {
  it("unknown command (top-level)", async () => expect(await code(["frobnicate"])).toBe(EXIT.USAGE));
  it("malformed JSON input", async () =>
    expect(await code(["vault", "validate", fixture("malformed.json")])).toBe(EXIT.USAGE));
  it("credential-shaped field rejected", async () =>
    expect(await code(["vault", "validate", fixture("vault.credential.json")])).toBe(EXIT.USAGE));
  it("the commander-error classifier itself maps every usage error to 2", () => {
    for (const c of [
      "commander.unknownOption",
      "commander.missingArgument",
      "commander.unknownCommand",
      "commander.excessArguments",
    ]) {
      expect(classifyCommanderError({ code: c, message: "error: x" }).code).toBe(EXIT.USAGE);
    }
  });
});

/**
 * FIXED (Agent 3, 8376b0f): `exitOverride` is now recursed through the whole
 * commander tree, so usage errors detected at a SUBCOMMAND route through
 * `classifyCommanderError` → exit 2 instead of `process.exit(1)`. These were
 * previously pinned to the buggy exit-1 behavior; they now assert the taxonomy.
 * A `process.exit` spy guards against any regression back to a direct exit.
 */
describe("§25 subcommand usage errors → 2 (regression-guarded)", () => {
  async function runGuarded(argv: string[]): Promise<{ exit: number; directExit?: number }> {
    let directExit: number | undefined;
    const spy = vi.spyOn(process, "exit").mockImplementation(((c?: number) => {
      directExit = c;
      throw new Error(`__unexpected_process_exit_${c}`);
    }) as never);
    try {
      const exit = await runCli(argv, { makeClient: () => mockClient(), onResult: () => {} });
      return { exit, directExit };
    } finally {
      spy.mockRestore();
    }
  }

  it("unknown option on a subcommand → 2 (no direct process.exit)", async () => {
    const { exit, directExit } = await runGuarded(["status", "--nope"]);
    expect(exit).toBe(EXIT.USAGE);
    expect(directExit).toBeUndefined();
  });
  it("missing required argument on a subcommand → 2", async () => {
    const { exit, directExit } = await runGuarded(["vault", "inspect"]);
    expect(exit).toBe(EXIT.USAGE);
    expect(directExit).toBeUndefined();
  });
  it("missing argument on a deeper subcommand (stake cooldown) → 2", async () => {
    const { exit } = await runGuarded(["stake", "cooldown"]);
    expect(exit).toBe(EXIT.USAGE);
  });
  it("unknown mcp subcommand → 2", async () => {
    const { exit } = await runGuarded(["mcp", "bogus"]);
    expect(exit).toBe(EXIT.USAGE);
  });
});

describe("§25 CONFIG → 3 (was 1)", () => {
  it("missing input file (ENOENT)", async () =>
    expect(await code(["vault", "validate", "/no/such/manifest.json"])).toBe(EXIT.CONFIG));
});

describe("§25 NETWORK → 4 (was 1)", () => {
  it("read command over a failing RPC (mock client throws network error)", async () =>
    expect(await code(["status"], { makeClient: () => networkFailingClient() })).toBe(EXIT.NETWORK));
  it("hosted MCP unreachable (injected down fetch)", async () =>
    expect(await code(["mcp", "status"], { mcpFetch: downMcpFetch })).toBe(EXIT.NETWORK));
  it("mcp tools unreachable → 4", async () =>
    expect(await code(["mcp", "tools"], { mcpFetch: downMcpFetch })).toBe(EXIT.NETWORK));
  it("mcp doctor unreachable → 4", async () =>
    expect(await code(["mcp", "doctor"], { mcpFetch: downMcpFetch })).toBe(EXIT.NETWORK));
});

describe("§25 POLICY / refusal → 5 (was 0)", () => {
  it("vault prepare-create refuses an INVALID manifest", async () =>
    expect(await code(["vault", "prepare-create", fixture("vault.invalid.json")])).toBe(EXIT.POLICY));
  it("coil compile refuses an INVALID manifest", async () =>
    expect(await code(["coil", "compile", fixture("coil.invalid.json")])).toBe(EXIT.POLICY));
});

describe("§25 VERIFICATION → 6 (was 0)", () => {
  it("vault validate INVALID", async () =>
    expect(await code(["vault", "validate", fixture("vault.invalid.json")])).toBe(EXIT.VERIFICATION));
  it("coil validate INVALID", async () =>
    expect(await code(["coil", "validate", fixture("coil.invalid.json")])).toBe(EXIT.VERIFICATION));
  it("receipt verify FAILED", async () =>
    expect(await code(["receipt", "verify", FAILED_RECEIPT])).toBe(EXIT.VERIFICATION));
});

describe("§25 PARTIAL / unknown → 7 (was 0)", () => {
  it("skill print not-found", async () =>
    expect(await code(["skill", "print", "does-not-exist"])).toBe(EXIT.PARTIAL));
  it("lp scan unavailable in this build", async () => expect(await code(["lp", "scan"])).toBe(EXIT.PARTIAL));
  it("lp positions unavailable", async () => expect(await code(["lp", "positions"])).toBe(EXIT.PARTIAL));
  it("lp prepare-mint unavailable", async () =>
    expect(await code(["lp", "prepare-mint"])).toBe(EXIT.PARTIAL));
  it("mcp doctor mixed (some pass, some fail) → 7", async () => {
    const mixed: FetchLike = async (url) => {
      if (url.endsWith("/version"))
        return { ok: true, status: 200, json: async () => ({ chainId: 4663, toolCount: 33 }) };
      return { ok: false, status: 503, json: async () => ({}) };
    };
    expect(await code(["mcp", "doctor"], { mcpFetch: mixed })).toBe(EXIT.PARTIAL);
  });
});

describe("§25 help / version → 0 (unchanged)", () => {
  it("--help", async () => expect(await code(["--help"])).toBe(0));
  it("--version", async () => expect(await code(["--version"])).toBe(0));
  it("bare invocation shows help → 0", async () => expect(await code([])).toBe(0));
});

describe("§25 TEXT IS UNCHANGED — only the process code moved", () => {
  it("vault validate INVALID renders identically whether code is 0 or 6", async () => {
    const result = await vaultValidateCommand(fixture("vault.invalid.json"));
    // The handler signals 6; the rendered body must not depend on the code.
    expect(result.exitCode).toBe(EXIT.VERIFICATION);

    const asMoved = capture({ mode: "human", color: false });
    renderResult(result, asMoved.ctx, { command: "vault validate", code: 6, ok: false });
    const asLegacy = capture({ mode: "human", color: false });
    renderResult(result, asLegacy.ctx, { command: "vault validate", code: 0, ok: true });
    expect(asMoved.out()).toBe(asLegacy.out());
    expect(asMoved.out()).toContain("INVALID");

    // JSON: the ONLY differences are the machine `ok`/`code` fields.
    const jMoved = capture({ mode: "json", color: false });
    renderResult(result, jMoved.ctx, { command: "vault validate", code: 6, ok: false });
    const parsed = JSON.parse(jMoved.out());
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe(6);
    expect(parsed.summary).toContain("INVALID");
    // The payload (data) carries the verdict unchanged.
    expect(parsed.data.ok).toBe(false);
  });
});
