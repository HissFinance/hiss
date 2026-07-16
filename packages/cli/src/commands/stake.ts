/**
 * `hiss stake ...` — xHISS staking status (read) plus prepare/cooldown/redeem
 * (unsigned transactions). Exits are user-initiated on-chain actions; HISS
 * only prepares the calldata.
 */

import type { CommandResult } from "../lib/output.js";
import type { HissClient, UnsignedTx } from "../lib/types.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function unsignedDetail(tx: UnsignedTx): string[] {
  return [
    `Chain: ${tx.chainId}`,
    `To: ${tx.to}`,
    `Value: ${tx.value} wei`,
    `Calldata: ${tx.data}`,
    "This transaction is UNSIGNED. Review it and submit it with your own wallet.",
  ];
}

export async function stakeStatusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getStakingStatus();
  const detail = [
    `xHISS vault: ${str(status.vaultAddress)}`,
    `Staking asset: ${str(status.stakingAsset, "HISS")}`,
    `Cooldown: ${str(status.cooldownSeconds ? String(status.cooldownSeconds) + "s" : undefined)}`,
    "Not a performance claim. Historical fee distributions are not forecasts.",
    "No known unresolved Critical or High findings after internal launch review.",
  ];
  return { summary: "xHISS staking status read.", data: status, detail };
}

export async function stakePrepareCommand(client: HissClient, amount: string): Promise<CommandResult> {
  const tx = await client.prepareHissStake(amount);
  return {
    summary: `Prepared an UNSIGNED stake of ${amount} HISS. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
  };
}

export async function stakeCooldownCommand(client: HissClient, xhissAmount: string): Promise<CommandResult> {
  const tx = await client.prepareXhissCooldown(xhissAmount);
  return {
    summary: `Prepared an UNSIGNED cooldown for ${xhissAmount} xHISS. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
  };
}

export async function stakeRedeemCommand(client: HissClient): Promise<CommandResult> {
  const tx = await client.prepareXhissRedeem();
  return {
    summary: "Prepared an UNSIGNED xHISS redeem within your open redeem window. Nothing was sent.",
    data: tx,
    detail: unsignedDetail(tx),
  };
}
