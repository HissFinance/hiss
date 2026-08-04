/**
 * `hiss status` and `hiss contracts` — read-only protocol snapshots.
 */

import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord } from "../lib/types.js";
import type { KVRow, StateToken, TableCell, ViewBlock } from "../lib/view.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Resolve an RPC/system reachability token from whatever the read surfaced. */
function rpcToken(status: JsonRecord): { state: StateToken; label: string } {
  if (status.reachable === true) return { state: "live", label: "LIVE" };
  if (status.reachable === false) return { state: "degraded", label: "DEGRADED" };
  return { state: "unknown", label: "UNKNOWN" };
}

/**
 * Map read reachability → process exit code (exit.ts taxonomy). Conservative:
 * only an AFFIRMATIVE `reachable === false` demotes the exit code. A read that
 * simply omits the field is treated as success (the demotion requires evidence
 * of failure, never its absence).
 *   reachable === false → 4 network (a DEGRADED read is an upstream/RPC
 *                         dependency failure — the SDK caught the RPC error and
 *                         returned a degraded object instead of throwing; the
 *                         exit code must still reflect the failed dependency)
 *   otherwise           → 0 success
 * The rendered human/JSON body is unchanged; only the exit code moves.
 */
function statusExitCode(status: JsonRecord): number {
  return status.reachable === false ? EXIT.NETWORK : EXIT.SUCCESS;
}

export async function statusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getProtocolStatus();
  const chain = str(status.chain, status.chainId != null ? String(status.chainId) : "unknown");
  // The chain id → network mapping is a static fact (4663 = Robinhood Chain
  // mainnet, 46630 = testnet); reachability stays a live read.
  const networkFallback =
    chain === "4663" ? "robinhood-chain-mainnet" : chain === "46630" ? "robinhood-chain-testnet" : "unknown";
  const network = str(status.network, networkFallback);
  const rpc = rpcToken(status);
  const detail: string[] = [
    `Network: ${network}`,
    `Chain: ${chain}`,
    `RPC: ${rpc.label}${typeof status.rpcUrl === "string" ? ` (${status.rpcUrl})` : ""}`,
    `Block: ${typeof status.blockNumber === "string" ? status.blockNumber : "UNKNOWN"}`,
  ];

  const rows: KVRow[] = [
    { label: "Network", value: network === "unknown" ? null : network, token: "value" },
    { label: "Chain", value: chain === "unknown" ? null : chain, token: "value" },
    { label: "RPC", value: rpc.label, token: rpc.state },
  ];
  if (typeof status.blockNumber === "string")
    rows.push({ label: "Block", value: status.blockNumber, token: "value" });
  if (status.rpcUrl) rows.push({ label: "RPC URL", value: str(status.rpcUrl), token: "muted" });
  if (status.token && typeof status.token === "object") {
    const token = status.token as JsonRecord;
    detail.push(`Token: ${str(token.symbol, "HISS")} at ${str(token.address)}`);
    rows.push({
      label: "Token",
      value: `${str(token.symbol, "HISS")} ${str(token.address)}`,
      token: "address",
    });
  }
  if (typeof status.vaultCount === "number") {
    detail.push(`Vaults tracked: ${status.vaultCount}`);
    rows.push({ label: "Vaults tracked", value: status.vaultCount, token: "value" });
  }
  if (status.treasurySafe) {
    detail.push(`Treasury Safe: ${str(status.treasurySafe)}`);
    rows.push({ label: "Treasury Safe", value: str(status.treasurySafe), token: "address", full: true });
  }
  // Vault lifecycle facts: the canonical V2 new-deposit vault + the legacy V1.
  const vaults = status.vaults;
  if (vaults && typeof vaults === "object") {
    const v = vaults as JsonRecord;
    if (typeof v.canonicalDepositVault === "string") {
      detail.push(`Canonical vault (V2): ${v.canonicalDepositVault}`);
      rows.push({
        label: "Canonical vault (V2)",
        value: v.canonicalDepositVault,
        token: "address",
        full: true,
      });
    }
    if (typeof v.legacyV1Vault === "string") {
      detail.push(`Legacy vault (V1): ${v.legacyV1Vault} — closed to new deposits`);
      rows.push({ label: "Legacy vault (V1)", value: v.legacyV1Vault, token: "address", full: true });
    }
  }

  const view: ViewBlock[] = [
    { kind: "status", state: rpc.state, label: `RPC ${rpc.label}`, note: `chain ${chain}` },
    { kind: "keyValue", title: "HISS Finance status", rows },
    ...(vaults && typeof vaults === "object"
      ? [
          {
            kind: "panel",
            variant: "info",
            lines: [
              "New deposits route to the canonical V2 vault (queue-routed epoch settlement).",
              "The V1 flagship is legacy: closed to new deposits; existing balances withdraw/redeem there.",
              "Queue/keeper/capacity state is a live read: hiss vault inspect <v2-address>.",
            ],
          } as ViewBlock,
        ]
      : []),
  ];

  return {
    summary: `HISS Finance status read from ${network}.`,
    data: status,
    detail,
    view,
    exitCode: statusExitCode(status),
  };
}

export async function contractsCommand(client: HissClient): Promise<CommandResult> {
  const registry = await client.getContractRegistry();
  // Two supported shapes: the SDK's detailed object report
  // `{ chainId, observedAt, entries: [{ name, address, status }] }`, or a flat
  // `{ name: address }` record (mocks/older clients).
  const reportEntries = Array.isArray(registry.entries)
    ? (registry.entries as JsonRecord[]).filter(
        (e) => typeof e.name === "string" && typeof e.address === "string",
      )
    : null;
  const entries: Array<[string, string, string | null]> = reportEntries
    ? reportEntries.map((e) => [
        String(e.name),
        String(e.address),
        typeof e.status === "string" ? e.status : null,
      ])
    : Object.entries(registry)
        .filter(([, v]) => typeof v === "string")
        .map(([name, addr]) => [name, String(addr), null]);
  const detail = entries.map(([name, addr, status]) => `${name}: ${addr}${status ? ` (${status})` : ""}`);
  const rows: TableCell[][] = entries.map(([name, addr, status]) => [
    name,
    { value: addr, token: "address" as const, full: true },
    ...(reportEntries ? [status === null ? null : status] : []),
  ]);
  const view: ViewBlock[] = [
    {
      kind: "table",
      title: "Contract registry",
      columns: [
        { header: "Contract" },
        { header: "Address" },
        ...(reportEntries ? [{ header: "Status" }] : []),
      ],
      rows,
    },
  ];
  return {
    summary: `Contract registry: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
    data: registry,
    detail,
    view,
    exitCode: EXIT.SUCCESS,
  };
}
