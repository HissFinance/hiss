/**
 * `hiss` command-line interface wiring (commander). This module maps commands
 * to the pure handlers in `./commands/*` and renders their results. The CLI is
 * READ or PREPARE only: it never asks for a private key or seed, never stores
 * a secret, never submits a transaction, and never hides a target address.
 */

import { Command } from "commander";
import { createHissClient, type ClientOptions } from "./lib/client.js";
import type { HissClient } from "./lib/types.js";
import { render, type CommandResult, type OutputMode } from "./lib/output.js";
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

export const CLI_VERSION = "0.1.0";

interface GlobalOpts {
  json?: boolean;
  quiet?: boolean;
  rpcUrl?: string;
  chainId?: string;
}

function outputMode(opts: GlobalOpts): OutputMode {
  if (opts.json) return "json";
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
  /** Called with the final result for each command (default: render to stdout). */
  onResult?: (result: CommandResult, mode: OutputMode) => void;
  /** Override skill lookup base directory (tests). */
  skillDir?: string;
}

/** Build the commander program. Exported so tests can drive it in-process. */
export function buildProgram(build: BuildOptions = {}): Command {
  const makeClient = build.makeClient ?? createHissClient;
  const emit = build.onResult ?? ((r, m) => render(r, m));

  const program = new Command();
  program
    .name("hiss")
    .description(
      "HISS Finance CLI — read protocol state and prepare unsigned transactions. Never signs or submits.",
    )
    .version(CLI_VERSION)
    .option("--json", "emit machine-readable JSON")
    .option("--quiet", "emit only the one-line summary")
    .option("--rpc-url <url>", "Robinhood Chain JSON-RPC endpoint (read-only)")
    .option("--chain-id <id>", "Robinhood Chain id (default 4663)");

  const global = (cmd: Command): GlobalOpts => cmd.optsWithGlobals() as GlobalOpts;
  const client = (cmd: Command): HissClient => makeClient(clientOptions(global(cmd)));
  const run = async (cmd: Command, result: Promise<CommandResult> | CommandResult): Promise<void> => {
    emit(await result, outputMode(global(cmd)));
  };

  program
    .command("status")
    .description("read a protocol status snapshot")
    .action(async function (this: Command) {
      await run(this, statusCommand(client(this)));
    });

  program
    .command("contracts")
    .description("read the deployed contract registry")
    .action(async function (this: Command) {
      await run(this, contractsCommand(client(this)));
    });

  const vault = program.command("vault").description("USDG Creator Vault commands");
  vault
    .command("list")
    .description("list vaults")
    .action(async function (this: Command) {
      await run(this, vaultListCommand(client(this)));
    });
  vault
    .command("inspect <addressOrSlug>")
    .description("inspect a vault")
    .action(async function (this: Command, ref: string) {
      await run(this, vaultInspectCommand(client(this), ref));
    });
  vault
    .command("holdings <address>")
    .description("read a vault's live holdings")
    .action(async function (this: Command, addr: string) {
      await run(this, vaultHoldingsCommand(client(this), addr));
    });
  vault
    .command("performance <address>")
    .description("read a vault's historical performance (not a forecast)")
    .action(async function (this: Command, addr: string) {
      await run(this, vaultPerformanceCommand(client(this), addr));
    });
  vault
    .command("create")
    .description("show the key-free vault-creation flow")
    .action(async function (this: Command) {
      await run(this, vaultCreateCommand());
    });
  vault
    .command("validate <manifest>")
    .description("validate a vault manifest (fail-closed)")
    .action(async function (this: Command, manifest: string) {
      await run(this, vaultValidateCommand(manifest));
    });
  vault
    .command("prepare-create <manifest>")
    .description("prepare an unsigned vault-creation transaction")
    .action(async function (this: Command, manifest: string) {
      await run(this, vaultPrepareCreateCommand(client(this), manifest));
    });
  vault
    .command("prepare-deposit <vault> <amount>")
    .description("prepare an unsigned USDG deposit transaction")
    .action(async function (this: Command, v: string, amount: string) {
      await run(this, vaultPrepareDepositCommand(client(this), v, amount));
    });
  vault
    .command("prepare-withdraw <vault> <shares>")
    .description("prepare an unsigned withdrawal transaction")
    .action(async function (this: Command, v: string, shares: string) {
      await run(this, vaultPrepareWithdrawCommand(client(this), v, shares));
    });

  const stake = program.command("stake").description("xHISS staking commands");
  stake
    .command("status")
    .description("read xHISS staking status")
    .action(async function (this: Command) {
      await run(this, stakeStatusCommand(client(this)));
    });
  stake
    .command("prepare <amount>")
    .description("prepare an unsigned HISS stake transaction")
    .action(async function (this: Command, amount: string) {
      await run(this, stakePrepareCommand(client(this), amount));
    });
  stake
    .command("cooldown <xhissAmount>")
    .description("prepare an unsigned xHISS cooldown transaction")
    .action(async function (this: Command, amount: string) {
      await run(this, stakeCooldownCommand(client(this), amount));
    });
  stake
    .command("redeem")
    .description("prepare an unsigned xHISS redeem transaction")
    .action(async function (this: Command) {
      await run(this, stakeRedeemCommand(client(this)));
    });

  const rewards = program.command("rewards").description("reward-status reporters (read-only)");
  rewards
    .command("status")
    .description("read reward status")
    .action(async function (this: Command) {
      await run(this, rewardsStatusCommand(client(this)));
    });
  rewards
    .command("contributor <address>")
    .description("read vault-contributor reward status")
    .action(async function (this: Command, address: string) {
      await run(this, rewardsContributorCommand(client(this), address));
    });
  rewards
    .command("provider <groupId>")
    .description("read provider reward status")
    .action(async function (this: Command, groupId: string) {
      await run(this, rewardsProviderCommand(client(this), groupId));
    });

  const coil = program.command("coil").description("CoilOps playbook commands (local, deterministic)");
  coil
    .command("validate <manifest>")
    .description("validate a coil manifest")
    .action(async function (this: Command, manifest: string) {
      await run(this, coilValidateCommand(manifest));
    });
  coil
    .command("compile <manifest>")
    .description("compile a coil manifest to a deterministic artifact")
    .action(async function (this: Command, manifest: string) {
      await run(this, coilCompileCommand(manifest));
    });

  const receipt = program.command("receipt").description("receipt commands");
  receipt
    .command("verify <receipt>")
    .description("verify a receipt's integrity hash (path or inline JSON)")
    .action(async function (this: Command, arg: string) {
      await run(this, receiptVerifyCommand(arg));
    });

  const skill = program.command("skill").description("agent skill packs");
  skill
    .command("list")
    .description("list available skill packs")
    .action(async function (this: Command) {
      await run(this, skillListCommand(build.skillDir));
    });
  skill
    .command("print <skill>")
    .description("print a skill pack's SKILL.md")
    .action(async function (this: Command, name: string) {
      await run(this, skillPrintCommand(name, build.skillDir));
    });

  return program;
}

/** Parse argv and execute. Returns the process exit code. */
export async function runCli(argv: string[], build: BuildOptions = {}): Promise<number> {
  const program = buildProgram(build);
  program.exitOverride();
  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (err) {
    const e = err as { code?: string; message?: string; exitCode?: number };
    // commander's help/version short-circuits are not errors.
    if (
      e.code === "commander.helpDisplayed" ||
      e.code === "commander.version" ||
      e.code === "commander.help"
    ) {
      return 0;
    }
    process.stderr.write(`hiss: ${e.message ?? String(err)}\n`);
    return typeof e.exitCode === "number" && e.exitCode !== 0 ? e.exitCode : 1;
  }
}
