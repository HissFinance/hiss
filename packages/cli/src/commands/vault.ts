/**
 * `hiss vault ...` — list, inspect, holdings, performance (reads) plus
 * validate / prepare-create / prepare-deposit / prepare-withdraw (local
 * validation + unsigned-transaction preparation). Nothing here signs, submits,
 * or hides a target address.
 */

import { readFile } from "node:fs/promises";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord, UnsignedTx } from "../lib/types.js";
import { assertNoCredentials } from "../lib/credentials.js";
import { validateVaultManifest } from "../lib/validate.js";
import type { StateToken, TableCell, ViewBlock } from "../lib/view.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Lifecycle token for a vault, derived facts-only from whatever the read
 * surfaced. Deposit acceptance is a LIVE read (planned ≠ open ≠ funded); an
 * absent field is UNKNOWN, never assumed open or closed.
 */
function vaultLifecycle(vault: JsonRecord): { state: StateToken; label: string } {
  const explicit = typeof vault.lifecycle === "string" ? vault.lifecycle.toUpperCase() : undefined;
  if (explicit === "LEGACY") return { state: "info", label: "LEGACY" };
  if (explicit === "CANARY") return { state: "warning", label: "CANARY" };
  if (explicit === "V2") return { state: "active", label: "V2" };
  const accepting = vault.acceptingPublicDeposits;
  const acc = accepting && typeof accepting === "object" ? (accepting as JsonRecord).value : accepting;
  if (acc === true) return { state: "active", label: "ACTIVE" };
  if (acc === false) return { state: "paused", label: "PAUSED" };
  if (accepting && typeof accepting === "object" && (accepting as JsonRecord).state === "degraded")
    return { state: "degraded", label: "DEGRADED" };
  return { state: "unknown", label: "UNKNOWN" };
}

export async function vaultListCommand(client: HissClient): Promise<CommandResult> {
  const vaults = await client.listVaults();
  const detail = vaults.map((v) => `${str(v.slug, str(v.name))} — ${str(v.address)}`);
  const rows: TableCell[][] = vaults.map((v) => {
    const lc = vaultLifecycle(v);
    return [
      str(v.slug, str(v.name)),
      { value: str(v.address), token: "address" as const, full: true },
      { value: lc.label, token: lc.state },
    ];
  });
  const view: ViewBlock[] = [
    {
      kind: "table",
      title: "Vaults on Robinhood Chain",
      columns: [{ header: "Vault" }, { header: "Address" }, { header: "State" }],
      rows,
    },
  ];
  return {
    summary: `${vaults.length} vault${vaults.length === 1 ? "" : "s"} on Robinhood Chain.`,
    data: vaults,
    detail,
    view,
    exitCode: EXIT.SUCCESS,
  };
}

export async function vaultInspectCommand(client: HissClient, ref: string): Promise<CommandResult> {
  const vault = await client.getVault(ref);
  const lc = vaultLifecycle(vault);
  const detail = [
    `Name: ${str(vault.name)}`,
    `Address: ${str(vault.address)}`,
    `Base asset: ${str(vault.baseAsset, "USDG")}`,
    `Deposits: read live on chain (planned ≠ open ≠ funded).`,
  ];
  const view: ViewBlock[] = [
    { kind: "status", state: lc.state, label: `Deposits ${lc.label}`, note: "live chain read" },
    {
      kind: "keyValue",
      title: `Vault ${str(vault.slug, ref)}`,
      rows: [
        { label: "Name", value: str(vault.name), token: "value" },
        { label: "Address", value: str(vault.address), token: "address", full: true },
        { label: "Base asset", value: str(vault.baseAsset, "USDG"), token: "value" },
        { label: "Deposits", value: lc.label, token: lc.state },
      ],
    },
    {
      kind: "panel",
      variant: "info",
      lines: ["Deposit state is a live chain read: planned != open != funded."],
    },
  ];
  return {
    summary: `Vault ${str(vault.slug, ref)} inspected.`,
    data: vault,
    detail,
    view,
    exitCode: EXIT.SUCCESS,
  };
}

export async function vaultHoldingsCommand(client: HissClient, vault: string): Promise<CommandResult> {
  const holdings = await client.getVaultHoldings(vault);
  const list = Array.isArray(holdings.holdings) ? (holdings.holdings as JsonRecord[]) : [];
  const rows: TableCell[][] = list.map((h) => {
    const readField = (f: unknown): TableCell => {
      if (f && typeof f === "object") {
        const r = f as JsonRecord;
        return r.state === "live" ? String(r.value) : { value: "UNKNOWN", token: "muted" };
      }
      return f == null ? { value: "UNKNOWN", token: "muted" } : String(f);
    };
    return [{ value: str(h.asset), token: "address" as const }, readField(h.symbol), readField(h.balance)];
  });
  const view: ViewBlock[] = [
    {
      kind: "keyValue",
      rows: [
        { label: "Vault", value: str(holdings.vault, vault), token: "address", full: true },
        { label: "Source", value: str(holdings.source, "live chain read"), token: "muted" },
      ],
    },
  ];
  if (rows.length > 0) {
    view.push({
      kind: "table",
      title: "Holdings (live chain read)",
      columns: [{ header: "Asset" }, { header: "Symbol" }, { header: "Balance", numeric: true }],
      rows,
    });
  }
  return {
    summary: `Holdings read for vault ${vault}.`,
    data: holdings,
    detail: [`Source: live chain read (${str(holdings.source, "onchain")}).`],
    view,
    exitCode: EXIT.SUCCESS,
  };
}

export async function vaultPerformanceCommand(client: HissClient, vault: string): Promise<CommandResult> {
  const perf = await client.getVaultPerformance(vault);
  const pps = perf.pricePerShare;
  const ppsVal =
    pps && typeof pps === "object" && (pps as JsonRecord).state === "live"
      ? String((pps as JsonRecord).value)
      : null;
  const view: ViewBlock[] = [
    {
      kind: "keyValue",
      title: "Vault performance (point-in-time read)",
      rows: [
        { label: "Vault", value: str(perf.vault, vault), token: "address", full: true },
        { label: "Price per share", value: ppsVal, token: ppsVal ? "value" : "muted" },
      ],
    },
    {
      kind: "panel",
      variant: "review",
      lines: [
        "Price-per-share is a live chain read, not a return or forecast.",
        "Not a forecast; not a performance claim.",
      ],
    },
  ];
  return {
    summary: `Historical performance read for vault ${vault}. Not a forecast; not a performance claim.`,
    data: perf,
    detail: ["Historical figures are not forecasts and are not guaranteed."],
    view,
    exitCode: EXIT.SUCCESS,
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
  const view: ViewBlock[] = verdict.ok
    ? [
        { kind: "status", state: "success", label: "VALID", note: verdict.schema },
        {
          kind: "panel",
          variant: "success",
          lines: ["Robinhood Chain, USDG base, fees in bounds, creator skin present, rebalance fuses set."],
        },
      ]
    : [
        {
          kind: "status",
          state: "error",
          label: `INVALID — ${verdict.issues.length} issue(s)`,
          note: verdict.schema,
        },
        {
          kind: "table",
          title: "Validation issues",
          columns: [{ header: "Code" }, { header: "Path" }, { header: "Message" }],
          rows: verdict.issues.map((i) => [
            { value: i.code, token: "error" as const },
            i.path || "(root)",
            i.message,
          ]),
        },
      ];
  return {
    summary: verdict.ok
      ? `Vault manifest VALID (${verdict.schema}).`
      : `Vault manifest INVALID: ${verdict.issues.length} issue(s).`,
    data: verdict,
    detail,
    view,
    exitCode: verdict.ok ? EXIT.SUCCESS : EXIT.VERIFICATION,
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

/** A data-only transaction-review block for an unsigned tx (signed:false, always). */
function unsignedView(tx: UnsignedTx, functionName: string): ViewBlock[] {
  return [
    {
      kind: "transaction",
      chainId: tx.chainId,
      to: tx.to,
      // Pass the raw wei value only — the transaction component renders the unit.
      value: tx.value,
      functionName,
      signed: false,
      note: "UNSIGNED — review and submit with your own wallet. Nothing was sent.",
    },
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
      view: [
        { kind: "status", state: "blocked", label: "REFUSED", note: "manifest INVALID — nothing prepared" },
        {
          kind: "table",
          title: "Validation issues",
          columns: [{ header: "Code" }, { header: "Path" }, { header: "Message" }],
          rows: verdict.issues.map((i) => [
            { value: i.code, token: "error" as const },
            i.path || "(root)",
            i.message,
          ]),
        },
      ],
      exitCode: EXIT.POLICY,
    };
  }
  const tx = await client.prepareVaultCreation(manifest as JsonRecord);
  return {
    summary: "Prepared an UNSIGNED vault-creation transaction. Nothing was sent.",
    data: tx,
    detail: unsignedDetail(tx),
    view: unsignedView(tx, "createVault"),
    exitCode: EXIT.SUCCESS,
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
    view: unsignedView(tx, "deposit"),
    exitCode: EXIT.SUCCESS,
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
    view: unsignedView(tx, "withdraw"),
    exitCode: EXIT.SUCCESS,
  };
}
