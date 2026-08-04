/**
 * `hiss vault ...` — list, inspect, holdings, performance (reads) plus
 * validate / prepare-create / prepare-deposit / prepare-withdraw (local
 * validation + unsigned-transaction preparation). Nothing here signs, submits,
 * or hides a target address.
 */

import { readFile } from "node:fs/promises";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord, PrepareVaultOpts, UnsignedTx } from "../lib/types.js";
import { assertNoCredentials } from "../lib/credentials.js";
import { validateVaultManifest } from "../lib/validate.js";
import type { KVRow, StateToken, TableCell, ViewBlock } from "../lib/view.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Lifecycle token for a vault, derived facts-only from whatever the read
 * surfaced. The SDK labels the canonical V2 vault `canonical_v2` and the
 * legacy V1 flagship `legacy_v1` (closed to new deposits — never the deposit
 * default). Deposit acceptance is a LIVE read (planned ≠ open ≠ funded); an
 * absent field is UNKNOWN, never assumed open or closed.
 */
function vaultLifecycle(vault: JsonRecord): { state: StateToken; label: string } {
  const explicit = typeof vault.lifecycle === "string" ? vault.lifecycle.toUpperCase() : undefined;
  if (explicit === "CANONICAL_V2") return { state: "active", label: "CANONICAL (V2)" };
  if (explicit === "LEGACY_V1") return { state: "info", label: "LEGACY (V1)" };
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

/** Unwrap a fail-soft SDK ReadResult to a display value; UNKNOWN when degraded. */
function readVal(v: unknown): string | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const r = v as JsonRecord;
    if (r.state === "live" && r.value != null) return String(r.value);
    return null;
  }
  return v == null ? null : String(v);
}

export async function vaultListCommand(client: HissClient): Promise<CommandResult> {
  const vaults = await client.listVaults();
  const detail = vaults.map((v) => {
    const lc = vaultLifecycle(v);
    return `${str(v.slug, str(readVal(v.name), str(v.address)))} — ${str(v.address)} [${lc.label}]`;
  });
  const rows: TableCell[][] = vaults.map((v) => {
    const lc = vaultLifecycle(v);
    return [
      str(v.slug, str(readVal(v.name), str(v.address))),
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
    {
      kind: "panel",
      variant: "info",
      lines: [
        "New deposits route to the CANONICAL V2 vault (queue-routed epoch settlement).",
        "The V1 flagship is LEGACY: closed to new deposits; existing balances withdraw/redeem there.",
      ],
    },
  ];
  return {
    summary: `${vaults.length} vault${vaults.length === 1 ? "" : "s"} on Robinhood Chain (canonical V2 first; legacy labeled).`,
    data: vaults,
    detail,
    view,
    exitCode: EXIT.SUCCESS,
  };
}

/** Format a USDG base-unit (6-dec) string as a decimal USDG amount. */
function usdg6(baseUnits: string | null): string | null {
  if (baseUnits === null || !/^\d+$/.test(baseUnits)) return null;
  const padded = baseUnits.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const frac = padded.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Declarative blocks for the canonical V2 vault's live lane status. */
function v2StatusBlocks(s: JsonRecord): ViewBlock[] {
  const source = (s.source ?? {}) as JsonRecord;
  const vaultReads = (s.vaultReads ?? {}) as JsonRecord;
  const queue = (s.queue ?? {}) as JsonRecord;
  const keeper = (s.keeper ?? {}) as JsonRecord;
  const rebalancing = (s.rebalancing ?? {}) as JsonRecord;
  const capacity = (s.capacity ?? {}) as JsonRecord;

  const paused = readVal(vaultReads.paused);
  const queuePaused = readVal(queue.paused);
  const queueActive = readVal(vaultReads.queueActive);
  const keeperState = typeof keeper.state === "string" ? keeper.state : "UNKNOWN";
  const rebActive = rebalancing.active;
  const rebByPolicy = rebalancing.byPolicy === true;

  const depCap =
    typeof capacity.immediateDepositCapacityUsdg === "string" ? capacity.immediateDepositCapacityUsdg : null;
  const redCap =
    typeof capacity.immediateUsdgRedemptionCapacityUsdg === "string"
      ? capacity.immediateUsdgRedemptionCapacityUsdg
      : null;

  const rows: KVRow[] = [
    {
      label: "Vault paused",
      value: paused === null ? null : paused === "true" ? "PAUSED" : "not paused",
      token: paused === "true" ? "paused" : paused === null ? "muted" : "active",
    },
    {
      label: "Queue lane",
      value:
        queueActive === null && queuePaused === null
          ? null
          : `${queueActive === "true" ? "armed" : queueActive === "false" ? "not armed" : "UNKNOWN"} · ${
              queuePaused === "true"
                ? "queue PAUSED"
                : queuePaused === "false"
                  ? "queue open"
                  : "queue UNKNOWN"
            }`,
      token: queuePaused === "true" ? "paused" : "value",
    },
    { label: "Queue pending", value: readVal(queue.pendingCount), token: "value" },
    {
      label: "Pending deposits",
      value: usdg6(readVal(queue.pendingDepositUsdg)) ?? null,
      token: "value",
    },
    { label: "Keeper", value: `${keeperState} — ${str(keeper.reason, "")}`.trim(), token: "value" },
    {
      label: "Rebalancing",
      value:
        rebActive === true
          ? `ACTIVE — ${str(rebalancing.reason, "")}`
          : rebByPolicy
            ? `INACTIVE BY POLICY — ${str(rebalancing.reason, "")}`
            : rebActive === null || rebActive === undefined
              ? null
              : `INACTIVE — ${str(rebalancing.reason, "")}`,
      // Owner-declared policy state, never a fault: render as info, not degraded.
      token: rebActive === true ? "active" : rebByPolicy ? "info" : "muted",
    },
    {
      label: "Deposit capacity",
      value: depCap === null ? null : `${usdg6(depCap) ?? depCap} USDG (live mesh read)`,
      token: "value",
    },
    {
      label: "Instant USDG redemption",
      value: redCap === null ? null : `${usdg6(redCap) ?? redCap} USDG (cash-bounded)`,
      token: "value",
    },
    { label: "USDG cash", value: usdg6(readVal(vaultReads.usdgCash)), token: "value" },
  ];

  return [
    { kind: "keyValue", title: "V2 live lane status", rows },
    {
      kind: "evidence",
      title: "Read evidence",
      refs: [
        {
          source: typeof source.rpcUrl === "string" ? `RPC ${source.rpcUrl}` : "RPC (unknown)",
          block: typeof source.blockNumber === "string" ? source.blockNumber : null,
          note: "Live chain reads; a failed leg is UNKNOWN, never fabricated. Not a performance claim.",
        },
      ],
    },
  ];
}

export async function vaultInspectCommand(client: HissClient, ref: string): Promise<CommandResult> {
  const vault = await client.getVault(ref);
  const lc = vaultLifecycle(vault);
  const isCanonicalV2 = vault.lifecycle === "canonical_v2";
  const detail = [
    `Name: ${str(readVal(vault.name), str(vault.name))}`,
    `Address: ${str(vault.address)}`,
    `Lifecycle: ${lc.label}`,
    `Base asset: ${str(vault.baseAsset, "USDG")}`,
    isCanonicalV2
      ? "Deposits: routed through the request queue (epoch batches) — state read live on chain."
      : `Deposits: read live on chain (planned ≠ open ≠ funded).`,
  ];
  const view: ViewBlock[] = [
    { kind: "status", state: lc.state, label: lc.label, note: "live chain read" },
    {
      kind: "keyValue",
      title: `Vault ${str(vault.slug, ref)}`,
      rows: [
        { label: "Name", value: str(readVal(vault.name), str(vault.name)), token: "value" },
        { label: "Address", value: str(vault.address), token: "address", full: true },
        { label: "Lifecycle", value: lc.label, token: lc.state },
        { label: "Base asset", value: str(vault.baseAsset, "USDG"), token: "value" },
        { label: "Total supply", value: readVal(vault.totalSupply), token: "value" },
        { label: "NAV (USDG units)", value: readVal(vault.totalAssets), token: "value" },
      ],
    },
  ];

  // Canonical V2: attach the live lane status (queue/keeper/rebalancing/capacity).
  let data: JsonRecord = vault;
  if (isCanonicalV2 && typeof client.getVaultV2Status === "function") {
    const v2Status = await client.getVaultV2Status();
    data = { ...vault, v2Status };
    view.push(...v2StatusBlocks(v2Status));
    // Plain/quiet surfaces render `detail` — mirror the lane facts there too.
    const q = (v2Status.queue ?? {}) as JsonRecord;
    const vr = (v2Status.vaultReads ?? {}) as JsonRecord;
    const kp = (v2Status.keeper ?? {}) as JsonRecord;
    const rb = (v2Status.rebalancing ?? {}) as JsonRecord;
    const cap = (v2Status.capacity ?? {}) as JsonRecord;
    const src = (v2Status.source ?? {}) as JsonRecord;
    const u = (x: unknown): string => str(readVal(x), "UNKNOWN");
    detail.push(
      `Queue: ${u(vr.queueActive) === "true" ? "armed" : u(vr.queueActive) === "false" ? "not armed" : "UNKNOWN"} · paused=${u(q.paused)} · pending=${u(q.pendingCount)}`,
      `Keeper: ${str(kp.state, "UNKNOWN")}`,
      rb.active === true
        ? `Rebalancing: ACTIVE (live read)`
        : rb.byPolicy === true
          ? `Rebalancing: INACTIVE BY POLICY — ${str(rb.reason, "")}`
          : `Rebalancing: UNKNOWN`,
      `Deposit capacity (USDG units): ${typeof cap.immediateDepositCapacityUsdg === "string" ? cap.immediateDepositCapacityUsdg : "UNKNOWN"}`,
      `Instant USDG redemption (USDG units): ${typeof cap.immediateUsdgRedemptionCapacityUsdg === "string" ? cap.immediateUsdgRedemptionCapacityUsdg : "UNKNOWN"}`,
      `Source: ${str(src.rpcUrl, "unknown RPC")} @ block ${typeof src.blockNumber === "string" ? src.blockNumber : "UNKNOWN"}`,
    );
  } else {
    view.push({
      kind: "panel",
      variant: "info",
      lines:
        vault.lifecycle === "legacy_v1"
          ? [
              "LEGACY V1 flagship: closed to new deposits; existing balances withdraw/redeem here.",
              "New deposits route to the canonical V2 vault (queue-routed epoch settlement).",
            ]
          : ["Deposit state is a live chain read: planned != open != funded."],
    });
  }

  return {
    summary: `Vault ${str(vault.slug, ref)} inspected${isCanonicalV2 ? " (canonical V2 — live lane status attached)" : ""}.`,
    data,
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
    ...(tx.warnings ?? []).map((w) => `Warning: ${w}`),
    `This transaction is UNSIGNED. Review it and submit it with your own wallet.`,
  ];
}

/** A data-only transaction-review block for an unsigned tx (signed:false, always). */
function unsignedView(tx: UnsignedTx, functionName: string): ViewBlock[] {
  const blocks: ViewBlock[] = [
    {
      kind: "transaction",
      chainId: tx.chainId,
      to: tx.to,
      // Pass the raw wei value only — the transaction component renders the unit.
      value: tx.value,
      functionName: tx.function ?? functionName,
      signed: false,
      note: "UNSIGNED — review and submit with your own wallet. Nothing was sent.",
    },
  ];
  if (tx.warnings && tx.warnings.length > 0) {
    blocks.push({ kind: "panel", variant: "review", title: "Before signing", lines: tx.warnings });
  }
  return blocks;
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
  receiver?: string,
  opts?: PrepareVaultOpts,
): Promise<CommandResult> {
  const tx = await client.prepareVaultDeposit(vault, amount, receiver, opts);
  return {
    summary: `Prepared an UNSIGNED deposit of ${amount} USDG toward ${vault}. Nothing was sent.`,
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
  receiver?: string,
  opts?: PrepareVaultOpts,
): Promise<CommandResult> {
  const tx = await client.prepareVaultWithdrawal(vault, shares, receiver, opts);
  return {
    summary: `Prepared an UNSIGNED withdrawal of ${shares} shares from ${vault}. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
    view: unsignedView(tx, "withdraw"),
    exitCode: EXIT.SUCCESS,
  };
}
