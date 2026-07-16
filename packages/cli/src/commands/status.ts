/**
 * `hiss status` and `hiss contracts` — read-only protocol snapshots.
 */

import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord } from "../lib/types.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export async function statusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getProtocolStatus();
  const chain = str(status.chain);
  const network = str(status.network);
  const detail: string[] = [`Network: ${network}`, `Chain: ${chain}`];
  if (status.token && typeof status.token === "object") {
    const token = status.token as JsonRecord;
    detail.push(`Token: ${str(token.symbol, "HISS")} at ${str(token.address)}`);
  }
  if (typeof status.vaultCount === "number") detail.push(`Vaults tracked: ${status.vaultCount}`);
  if (status.treasurySafe) detail.push(`Treasury Safe: ${str(status.treasurySafe)}`);

  return {
    summary: `HISS Finance status read from ${network}.`,
    data: status,
    detail,
  };
}

export async function contractsCommand(client: HissClient): Promise<CommandResult> {
  const registry = await client.getContractRegistry();
  const entries = Object.entries(registry).filter(([, v]) => typeof v === "string");
  const detail = entries.map(([name, addr]) => `${name}: ${String(addr)}`);
  return {
    summary: `Contract registry: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
    data: registry,
    detail,
  };
}
