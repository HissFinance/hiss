/**
 * `hiss vault ...` — list, inspect, holdings, performance (reads) plus
 * validate / prepare-create / prepare-deposit / prepare-withdraw (local
 * validation + unsigned-transaction preparation). Nothing here signs, submits,
 * or hides a target address.
 */

import { readFile } from "node:fs/promises";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord, UnsignedTx } from "../lib/types.js";
import { assertNoCredentials } from "../lib/credentials.js";
import { validateVaultManifest } from "../lib/validate.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export async function vaultListCommand(client: HissClient): Promise<CommandResult> {
  const vaults = await client.listVaults();
  const detail = vaults.map((v) => `${str(v.slug, str(v.name))} — ${str(v.address)}`);
  return {
    summary: `${vaults.length} vault${vaults.length === 1 ? "" : "s"} on Robinhood Chain.`,
    data: vaults,
    detail,
  };
}

export async function vaultInspectCommand(client: HissClient, ref: string): Promise<CommandResult> {
  const vault = await client.getVault(ref);
  const detail = [
    `Name: ${str(vault.name)}`,
    `Address: ${str(vault.address)}`,
    `Base asset: ${str(vault.baseAsset, "USDG")}`,
    `Deposits: read live on chain (planned ≠ open ≠ funded).`,
  ];
  return { summary: `Vault ${str(vault.slug, ref)} inspected.`, data: vault, detail };
}

export async function vaultHoldingsCommand(client: HissClient, vault: string): Promise<CommandResult> {
  const holdings = await client.getVaultHoldings(vault);
  return {
    summary: `Holdings read for vault ${vault}.`,
    data: holdings,
    detail: [`Source: live chain read at ${str(holdings.readAtIso, "read time")}.`],
  };
}

export async function vaultPerformanceCommand(client: HissClient, vault: string): Promise<CommandResult> {
  const perf = await client.getVaultPerformance(vault);
  return {
    summary: `Historical performance read for vault ${vault}. Not a forecast; not a performance claim.`,
    data: perf,
    detail: ["Historical figures are not forecasts and are not guaranteed."],
  };
}

async function loadJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function vaultValidateCommand(manifestPath: string): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  const verdict = validateVaultManifest(manifest);
  const detail = verdict.ok
    ? [
        "Manifest is valid: Robinhood Chain, USDG base, fees in bounds, creator skin present, rebalance fuses set.",
      ]
    : verdict.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`);
  return {
    summary: verdict.ok
      ? `Vault manifest VALID (${verdict.schema}).`
      : `Vault manifest INVALID: ${verdict.issues.length} issue(s).`,
    data: verdict,
    detail,
  };
}

function unsignedDetail(tx: UnsignedTx): string[] {
  return [
    `Chain: ${tx.chainId}`,
    `To: ${tx.to}`,
    `Value: ${tx.value} wei`,
    `Calldata: ${tx.data}`,
    `This transaction is UNSIGNED. Review it and submit it with your own wallet.`,
  ];
}

export async function vaultCreateCommand(): Promise<CommandResult> {
  return {
    summary: "Vault creation is a two-step, key-free flow: `vault validate` then `vault prepare-create`.",
    data: {
      steps: [
        "hiss vault validate <manifest.json>",
        "hiss vault prepare-create <manifest.json>  # emits an unsigned transaction",
        "Submit the unsigned transaction with your own wallet.",
      ],
      note: "HISS never signs or submits. It never holds keys or takes custody.",
    },
  };
}

export async function vaultPrepareCreateCommand(
  client: HissClient,
  manifestPath: string,
): Promise<CommandResult> {
  const manifest = await loadJsonFile(manifestPath);
  assertNoCredentials(manifest);
  const verdict = validateVaultManifest(manifest);
  if (!verdict.ok) {
    return {
      summary: `Refusing to prepare: manifest INVALID (${verdict.issues.length} issue(s)).`,
      data: verdict,
      detail: verdict.issues.map((i) => `${i.code} @ ${i.path || "(root)"}: ${i.message}`),
    };
  }
  const tx = await client.prepareVaultCreation(manifest as JsonRecord);
  return {
    summary: "Prepared an UNSIGNED vault-creation transaction. Nothing was sent.",
    data: tx,
    detail: unsignedDetail(tx),
  };
}

export async function vaultPrepareDepositCommand(
  client: HissClient,
  vault: string,
  amount: string,
): Promise<CommandResult> {
  const tx = await client.prepareVaultDeposit(vault, amount);
  return {
    summary: `Prepared an UNSIGNED deposit of ${amount} USDG to ${vault}. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
  };
}

export async function vaultPrepareWithdrawCommand(
  client: HissClient,
  vault: string,
  shares: string,
): Promise<CommandResult> {
  const tx = await client.prepareVaultWithdrawal(vault, shares);
  return {
    summary: `Prepared an UNSIGNED withdrawal of ${shares} shares from ${vault}. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
  };
}
