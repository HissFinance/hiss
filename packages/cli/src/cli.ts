/**
 * `hiss` command-line interface wiring (commander). This module maps commands
 * to the pure handlers in `./commands/*`, resolves the global output flags into
 * a single {@link OutputContext}, renders each result through the canonical
 * renderer, and maps outcomes to the stable exit-code taxonomy (`./lib/exit`).
 *
 * The CLI is READ or PREPARE only: it never asks for a private key or seed,
 * never stores a secret, never submits a transaction, and never hides a target
 * address.
 *
 * BEHAVIOR CHANGE (OUTPUT_CONTRACT §6, regression-guarded by Agent 4): business
 * fail-closed outcomes now carry a NON-ZERO exit code (validate INVALID → 6,
 * compile/prepare refusal → 5, receipt FAILED → 6, skill not-found → 7, …).
 * They previously all exited 0. The rendered human/JSON text is unchanged; only
 * the process exit code moves. See `./lib/exit.ts`.
 */

import { Command, Option } from "commander";
import { createHissClient, type ClientOptions } from "./lib/client.js";
import type { HissClient } from "./lib/types.js";
import { renderResult, renderErrorResult, type CommandResult, type OutputMode } from "./lib/output.js";
import { buildProcessContext, type OutputContext } from "./lib/context.js";
import type { RenderMode } from "./lib/capabilities.js";
import { classifyThrown, classifyCommanderError, isCommanderSuccessShortCircuit, EXIT } from "./lib/exit.js";
import { statusCommand, contractsCommand } from "./commands/status.js";
import {
  vaultListCommand,
  vaultInspectCommand,
  vaultHoldingsCommand,
  vaultPerformanceCommand,
  vaultValidateCommand,
  vaultCreateCommand,
  vaultPrepareCreateCommand,
  vaultPrepareDepositCommand,
  vaultPrepareWithdrawCommand,
} from "./commands/vault.js";
import {
  stakeStatusCommand,
  stakePrepareCommand,
  stakeCooldownCommand,
  stakeRedeemCommand,
} from "./commands/stake.js";
import {
  rewardsStatusCommand,
  rewardsContributorCommand,
  rewardsProviderCommand,
} from "./commands/rewards.js";
import { coilValidateCommand, coilCompileCommand } from "./commands/coil.js";
import { receiptVerifyCommand } from "./commands/receipt.js";
import { skillListCommand, skillPrintCommand } from "./commands/skill.js";
import { mcpStatusCommand, mcpToolsCommand, mcpDoctorCommand, type FetchLike } from "./commands/mcp.js";
import {
  lpStatusCommand,
  lpFeesCommand,
  lpScanCommand,
  lpPoolsCommand,
  lpPositionsCommand,
  lpPositionCommand,
  lpPrepareMintCommand,
  lpPrepareCollectCommand,
  lpPrepareCloseCommand,
} from "./commands/lp.js";
import {
  agenticStatusCommand,
  agenticSetupCommand,
  agenticCoilsCommand,
  agenticGrantsCommand,
  agenticReceiptsCommand,
} from "./commands/agentic.js";

export const CLI_VERSION = "0.2.1";

interface GlobalOpts {
  output?: RenderMode;
  json?: boolean;
  plain?: boolean;
  color?: "auto" | "always" | "never";
  unicode?: "auto" | "always" | "never";
  quiet?: boolean;
  verbose?: boolean;
  rpcUrl?: string;
  chainId?: string;
}

/** Map resolved global flags into the capability inputs for the context. */
function contextFlags(opts: GlobalOpts) {
  return {
    jsonFlag: opts.json,
    outputFlag: opts.output,
    plainFlag: opts.plain,
    colorFlag: opts.color,
    unicodeFlag: opts.unicode,
    quiet: opts.quiet,
    verbose: opts.verbose,
  };
}

/** Legacy 3-value mode for the `onResult` test seam. */
function legacyMode(opts: GlobalOpts): OutputMode {
  if (opts.json || opts.output === "json") return "json";
  if (opts.quiet) return "quiet";
  return "human";
}

function clientOptions(opts: GlobalOpts): ClientOptions {
  return {
    rpcUrl: opts.rpcUrl ?? process.env.HISS_RPC_URL,
    chainId: opts.chainId ? Number(opts.chainId) : undefined,
  };
}

export interface BuildOptions {
  /** Inject a client (tests). Defaults to a real SDK-backed client. */
  makeClient?: (opts: ClientOptions) => HissClient;
  /** Called with the final result for each command (default: context render). */
  onResult?: (result: CommandResult, mode: OutputMode) => void;
  /** Override skill lookup base directory (tests). */
  skillDir?: string;
  /** Inject a fetch impl for the `mcp` commands (tests). Defaults to global fetch. */
  mcpFetch?: FetchLike;
  /** Override the hosted MCP base URL (tests). */
  mcpBaseUrl?: string;
}

/** Captured outcome of the single command that ran this invocation. */
interface RunSink {
  result?: CommandResult;
  command?: string;
  opts?: GlobalOpts;
}

/** Build the commander program. Exported so tests can drive it in-process. */
export function buildProgram(build: BuildOptions = {}, sink: RunSink = {}): Command {
  const makeClient = build.makeClient ?? createHissClient;
  const mcpFetch: FetchLike = build.mcpFetch ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);

  const program = new Command();
  program
    .name("hiss")
    .description(
      "HISS Finance CLI — the read-and-prepare control plane for Robinhood Chain. Reads protocol state and prepares UNSIGNED transactions. Never signs, submits, or holds keys.",
    )
    .version(CLI_VERSION)
    .addOption(new Option("--output <mode>", "output mode").choices(["human", "json", "plain"]))
    .option("--json", "shorthand for --output json (machine-readable)")
    .option("--plain", "shorthand for --output plain (ASCII, no color, stable labels)")
    .addOption(new Option("--color <when>", "color policy").choices(["auto", "always", "never"]))
    .addOption(
      new Option("--unicode <when>", "Unicode/box-drawing policy").choices(["auto", "always", "never"]),
    )
    .option("--quiet", "verbosity: print only the one-line summary")
    .option("--verbose", "verbosity: extra diagnostics to stderr")
    .option("--rpc-url <url>", "Robinhood Chain JSON-RPC endpoint (read-only)")
    .option("--chain-id <id>", "Robinhood Chain id (default 4663)")
    .showHelpAfterError();

  addHelpGroups(program);

  const global = (cmd: Command): GlobalOpts => cmd.optsWithGlobals() as GlobalOpts;
  const client = (cmd: Command): HissClient => makeClient(clientOptions(global(cmd)));
  const run = async (
    cmd: Command,
    command: string,
    result: Promise<CommandResult> | CommandResult,
  ): Promise<void> => {
    sink.result = await result;
    sink.command = command;
    sink.opts = global(cmd);
  };

  program
    .command("status")
    .description("read a compact protocol/system status snapshot")
    .action(async function (this: Command) {
      await run(this, "status", statusCommand(client(this)));
    });

  program
    .command("contracts")
    .description("read the deployed contract registry")
    .action(async function (this: Command) {
      await run(this, "contracts", contractsCommand(client(this)));
    });

  // -- vaults ---------------------------------------------------------------
  const vault = program.command("vault").description("USDG Creator Vault commands");
  vault
    .command("list")
    .description("list vaults with lifecycle state")
    .action(async function (this: Command) {
      await run(this, "vault list", vaultListCommand(client(this)));
    });
  vault
    .command("inspect <addressOrSlug>")
    .description("inspect a vault")
    .action(async function (this: Command, ref: string) {
      await run(this, "vault inspect", vaultInspectCommand(client(this), ref));
    });
  vault
    .command("holdings <address>")
    .description("read a vault's live holdings")
    .action(async function (this: Command, addr: string) {
      await run(this, "vault holdings", vaultHoldingsCommand(client(this), addr));
    });
  vault
    .command("performance <address>")
    .description("read a vault's point-in-time performance (not a forecast)")
    .action(async function (this: Command, addr: string) {
      await run(this, "vault performance", vaultPerformanceCommand(client(this), addr));
    });
  vault
    .command("create")
    .description("show the key-free vault-creation flow")
    .action(async function (this: Command) {
      await run(this, "vault create", vaultCreateCommand());
    });
  vault
    .command("validate <manifest>")
    .description("validate a vault manifest (fail-closed; INVALID exits 6)")
    .action(async function (this: Command, manifest: string) {
      await run(this, "vault validate", vaultValidateCommand(manifest));
    });
  vault
    .command("prepare-create <manifest>")
    .description("prepare an unsigned vault-creation transaction (refusal exits 5)")
    .action(async function (this: Command, manifest: string) {
      await run(this, "vault prepare-create", vaultPrepareCreateCommand(client(this), manifest));
    });
  vault
    .command("prepare-deposit <vault> <amount>")
    .description("prepare an unsigned USDG deposit transaction")
    .action(async function (this: Command, v: string, amount: string) {
      await run(this, "vault prepare-deposit", vaultPrepareDepositCommand(client(this), v, amount));
    });
  vault
    .command("prepare-withdraw <vault> <shares>")
    .description("prepare an unsigned withdrawal transaction")
    .action(async function (this: Command, v: string, shares: string) {
      await run(this, "vault prepare-withdraw", vaultPrepareWithdrawCommand(client(this), v, shares));
    });

  // -- stake ----------------------------------------------------------------
  const stake = program.command("stake").description("xHISS staking commands");
  stake
    .command("status")
    .description("read xHISS staking status")
    .action(async function (this: Command) {
      await run(this, "stake status", stakeStatusCommand(client(this)));
    });
  stake
    .command("prepare <amount>")
    .description("prepare an unsigned HISS stake transaction")
    .action(async function (this: Command, amount: string) {
      await run(this, "stake prepare", stakePrepareCommand(client(this), amount));
    });
  stake
    .command("cooldown <xhissAmount>")
    .description("prepare an unsigned xHISS cooldown transaction")
    .action(async function (this: Command, amount: string) {
      await run(this, "stake cooldown", stakeCooldownCommand(client(this), amount));
    });
  stake
    .command("redeem")
    .description("prepare an unsigned xHISS redeem transaction")
    .action(async function (this: Command) {
      await run(this, "stake redeem", stakeRedeemCommand(client(this)));
    });

  // -- rewards --------------------------------------------------------------
  const rewards = program.command("rewards").description("reward-status reporters (read-only)");
  rewards
    .command("status")
    .description("read reward status (planned != funded != claimable)")
    .action(async function (this: Command) {
      await run(this, "rewards status", rewardsStatusCommand(client(this)));
    });
  rewards
    .command("contributor <address>")
    .description("read vault-contributor reward status")
    .action(async function (this: Command, address: string) {
      await run(this, "rewards contributor", rewardsContributorCommand(client(this), address));
    });
  rewards
    .command("provider <groupId>")
    .description("read provider reward status")
    .action(async function (this: Command, groupId: string) {
      await run(this, "rewards provider", rewardsProviderCommand(client(this), groupId));
    });

  // -- coil -----------------------------------------------------------------
  const coil = program.command("coil").description("CoilOps playbook commands (local, deterministic)");
  coil
    .command("validate <manifest>")
    .description("validate a coil manifest (INVALID exits 6)")
    .action(async function (this: Command, manifest: string) {
      await run(this, "coil validate", coilValidateCommand(manifest));
    });
  coil
    .command("compile <manifest>")
    .description("compile a coil manifest to a deterministic plan (refusal exits 5)")
    .action(async function (this: Command, manifest: string) {
      await run(this, "coil compile", coilCompileCommand(manifest));
    });

  // -- receipt --------------------------------------------------------------
  const receipt = program.command("receipt").description("receipt commands");
  receipt
    .command("verify <receipt>")
    .description("verify a receipt's integrity hash (path or inline JSON; FAILED exits 6)")
    .action(async function (this: Command, arg: string) {
      await run(this, "receipt verify", receiptVerifyCommand(arg));
    });

  // -- mcp ------------------------------------------------------------------
  const mcp = program.command("mcp").description("inspect the hosted HISS MCP server");
  mcp
    .command("status")
    .description("read the hosted MCP endpoint/transport/chain/readiness/toolset")
    .action(async function (this: Command) {
      await run(this, "mcp status", mcpStatusCommand(mcpFetch, build.mcpBaseUrl));
    });
  mcp
    .command("tools")
    .description("read the hosted MCP tool count + toolset hash")
    .action(async function (this: Command) {
      await run(this, "mcp tools", mcpToolsCommand(mcpFetch, build.mcpBaseUrl));
    });
  mcp
    .command("doctor")
    .description("run every public MCP probe and report per-check verdicts")
    .action(async function (this: Command) {
      await run(this, "mcp doctor", mcpDoctorCommand(mcpFetch, build.mcpBaseUrl));
    });

  // -- lp -------------------------------------------------------------------
  const lp = program.command("lp").description("Stock-Premium LP (HissLpManagerV1) commands");
  lp.command("status")
    .description("read the canonical LP manager deployment record")
    .action(async function (this: Command) {
      await run(this, "lp status", lpStatusCommand());
    });
  lp.command("fees")
    .description("read the immutable LP management-fee policy")
    .action(async function (this: Command) {
      await run(this, "lp fees", lpFeesCommand());
    });
  lp.command("scan")
    .description("scan enrollable LP opportunities (UNKNOWN in this build)")
    .action(async function (this: Command) {
      await run(this, "lp scan", lpScanCommand());
    });
  lp.command("pools")
    .description("list LP pools (UNKNOWN in this build)")
    .action(async function (this: Command) {
      await run(this, "lp pools", lpPoolsCommand());
    });
  lp.command("positions")
    .description("list LP positions (UNKNOWN in this build)")
    .action(async function (this: Command) {
      await run(this, "lp positions", lpPositionsCommand());
    });
  lp.command("position <id>")
    .description("read a single LP position (UNKNOWN in this build)")
    .action(async function (this: Command, id: string) {
      await run(this, "lp position", lpPositionCommand(id));
    });
  lp.command("prepare-mint")
    .description("prepare an unsigned LP mint (unavailable in this build)")
    .action(async function (this: Command) {
      await run(this, "lp prepare-mint", lpPrepareMintCommand());
    });
  lp.command("prepare-collect")
    .description("prepare an unsigned LP fee collect (unavailable in this build)")
    .action(async function (this: Command) {
      await run(this, "lp prepare-collect", lpPrepareCollectCommand());
    });
  lp.command("prepare-close")
    .description("prepare an unsigned LP close (unavailable in this build)")
    .action(async function (this: Command) {
      await run(this, "lp prepare-close", lpPrepareCloseCommand());
    });

  // -- agentic --------------------------------------------------------------
  const agentic = program.command("agentic").description("agentic control-plane orientation (informational)");
  agentic
    .command("status")
    .description("control-plane posture + execution boundary")
    .action(async function (this: Command) {
      await run(this, "agentic status", agenticStatusCommand());
    });
  agentic
    .command("setup")
    .description("how to connect the MCP rails (no credential request)")
    .action(async function (this: Command) {
      await run(this, "agentic setup", agenticSetupCommand());
    });
  agentic
    .command("coils")
    .description("coil states + how to compile them")
    .action(async function (this: Command) {
      await run(this, "agentic coils", agenticCoilsCommand());
    });
  agentic
    .command("grants")
    .description("granted capability families (read + prepare only)")
    .action(async function (this: Command) {
      await run(this, "agentic grants", agenticGrantsCommand());
    });
  agentic
    .command("receipts")
    .description("the receipt lifecycle + how to verify locally")
    .action(async function (this: Command) {
      await run(this, "agentic receipts", agenticReceiptsCommand());
    });

  // -- skill ----------------------------------------------------------------
  const skill = program.command("skill").description("agent skill packs");
  skill
    .command("list")
    .description("list available skill packs")
    .action(async function (this: Command) {
      await run(this, "skill list", skillListCommand(build.skillDir));
    });
  skill
    .command("print <skill>")
    .description("print a skill pack's SKILL.md (not-found exits 7)")
    .action(async function (this: Command, name: string) {
      await run(this, "skill print", skillPrintCommand(name, build.skillDir));
    });

  return program;
}

/** Top-level help, regrouped by INTENT (OUTPUT_CONTRACT §19). */
function addHelpGroups(program: Command): void {
  program.addHelpText(
    "after",
    `
Commands by intent:
  AGENTIC TRADING   agentic status|setup|coils|grants|receipts   coil validate|compile
  LIQUIDITY         lp status|fees|scan|pools|positions|position|prepare-mint|prepare-collect|prepare-close
  VAULTS            vault list|inspect|holdings|performance|validate|prepare-create|prepare-deposit|prepare-withdraw
                    stake status|prepare|cooldown|redeem     rewards status|contributor|provider
  COILS             coil validate|compile
  RECEIPTS          receipt verify
  PROTOCOL          status   contracts   mcp status|tools|doctor
  DEVELOPER         skill list|print

Output modes (global): --output human|json|plain  ·  --json  ·  --plain
  human  rich, semantic color + Unicode when supported (default, interactive)
  json   a stable JSON envelope on stdout ONLY — never any ANSI; diagnostics to stderr
  plain  ASCII, no color, stable labels (logs, screen readers, dumb terminals)
Color/Unicode: --color auto|always|never  --unicode auto|always|never  (respect NO_COLOR)
Verbosity: --quiet (summary only)  --verbose (extra diagnostics to stderr)

Exit codes: 0 success · 1 error · 2 usage · 3 config · 4 network · 5 policy/refusal
            6 verification-failed · 7 partial/unknown
  (Behavior change: business INVALID/FAILED/refusal now exit non-zero, not 0.)

Execution boundary: HISS READS and PREPARES only. Every prepared transaction is
UNSIGNED (signed:false, nothing sent). HISS never signs, submits, holds keys, or
requests a brokerage credential. Brokerage execution is entirely user-side.

Examples:
  hiss status --json | jq .data
  hiss vault validate ./vault.json ; echo "exit=$?"
  hiss stake prepare 1000
  hiss mcp doctor --plain
  hiss lp status
`,
  );
}

/** Apply `exitOverride` to a command and every subcommand (recursively). */
function applyExitOverride(cmd: Command): void {
  cmd.exitOverride();
  for (const sub of cmd.commands) applyExitOverride(sub);
}

/** Build an OutputContext for the error path by scanning argv for output flags. */
function contextFromArgv(argv: string[]): OutputContext {
  const valAfter = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const out = valAfter("--output");
  const outputFlag: RenderMode | undefined =
    out === "human" || out === "json" || out === "plain" ? out : undefined;
  const when = (v: string | undefined): "auto" | "always" | "never" | undefined =>
    v === "auto" || v === "always" || v === "never" ? v : undefined;
  return buildProcessContext({
    jsonFlag: argv.includes("--json"),
    outputFlag,
    plainFlag: argv.includes("--plain"),
    colorFlag: when(valAfter("--color")),
    unicodeFlag: when(valAfter("--unicode")),
    quiet: argv.includes("--quiet"),
    verbose: argv.includes("--verbose"),
  });
}

/**
 * Parse argv and execute. Returns the process exit code (OUTPUT_CONTRACT §6).
 * A single command runs per invocation; its `CommandResult.exitCode` (default 0)
 * becomes the process code. Thrown/usage errors are classified by `./lib/exit`.
 */
export async function runCli(argv: string[], build: BuildOptions = {}): Promise<number> {
  const sink: RunSink = {};
  const program = buildProgram(build, sink);
  // exitOverride is NOT inherited by subcommands — commander lets an unhandled
  // SUBcommand usage error call process.exit(1), bypassing the exit taxonomy.
  // Apply it to every node in the tree so ALL usage errors throw into our
  // handler and route through classifyCommanderError → exit 2 (§6).
  applyExitOverride(program);

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    // Help/version short-circuits are not errors.
    if (isCommanderSuccessShortCircuit(e.code)) return 0;
    const ctx = contextFromArgv(argv);
    // Commander usage errors (unknown command/option, missing arg) → exit 2.
    const classified =
      typeof e.code === "string" && e.code.startsWith("commander.")
        ? classifyCommanderError(e)
        : classifyThrown(err);
    renderErrorResult(classified, ctx, { command: sink.command, cliVersion: CLI_VERSION });
    return classified.code;
  }

  // No subcommand matched (bare `hiss`) → show help, exit 0.
  if (!sink.result || !sink.opts) {
    program.outputHelp();
    return 0;
  }

  const { result, command, opts } = sink;
  const code = result.exitCode ?? EXIT.SUCCESS;

  // Test seam: `onResult` bypasses context rendering but keeps the exit code.
  if (build.onResult) {
    build.onResult(result, legacyMode(opts));
    return code;
  }

  const ctx = buildProcessContext(contextFlags(opts));
  try {
    renderResult(result, ctx, { command, cliVersion: CLI_VERSION, code, ok: code === EXIT.SUCCESS });
    if (ctx.verbosity === "verbose") {
      const co = clientOptions(opts);
      // Route the diagnostic through redaction: an --rpc-url can carry
      // `scheme://user:pass@host` userinfo, and this line goes to stderr via the
      // RAW writer (not the renderer), so it must be redacted here or the
      // credential leaks. redact() preserves the host, masking only the secret.
      const diag =
        `hiss: command=${command ?? "?"} exit=${code} chain=${opts.chainId ?? "4663"}` +
        (co.rpcUrl ? ` rpc=${co.rpcUrl}` : "");
      ctx.stderr(ctx.redact(diag) + "\n");
    }
  } catch (err) {
    // A render fault (e.g. execution-claim guard trip) is an internal error.
    const classified = classifyThrown(err);
    renderErrorResult(classified, ctx, { command, cliVersion: CLI_VERSION });
    return classified.code;
  }
  return code;
}
