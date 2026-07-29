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

export async function statusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getProtocolStatus();
  const chain = str(status.chain, status.chainId != null ? String(status.chainId) : "unknown");
  const network = str(status.network);
  const detail: string[] = [`Network: ${network}`, `Chain: ${chain}`];
  const rpc = rpcToken(status);

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

  const view: ViewBlock[] = [
    { kind: "status", state: rpc.state, label: `RPC ${rpc.label}`, note: `chain ${chain}` },
    { kind: "keyValue", title: "HISS Finance status", rows },
  ];

  return {
    summary: `HISS Finance status read from ${network}.`,
    data: status,
    detail,
    view,
    exitCode: EXIT.SUCCESS,
  };
}

export async function contractsCommand(client: HissClient): Promise<CommandResult> {
  const registry = await client.getContractRegistry();
  const entries = Object.entries(registry).filter(([, v]) => typeof v === "string");
  const detail = entries.map(([name, addr]) => `${name}: ${String(addr)}`);
  const rows: TableCell[][] = entries.map(([name, addr]) => [
    name,
    { value: String(addr), token: "address" as const, full: true },
  ]);
  const view: ViewBlock[] = [
    {
      kind: "table",
      title: "Contract registry",
      columns: [{ header: "Contract" }, { header: "Address" }],
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
