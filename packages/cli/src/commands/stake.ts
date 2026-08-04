/**
 * `hiss stake ...` — xHISS staking status (read) plus prepare/cooldown/redeem
 * (unsigned transactions). Exits are user-initiated on-chain actions; HISS
 * only prepares the calldata.
 */

import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord, UnsignedTx } from "../lib/types.js";
import type { StateToken, ViewBlock } from "../lib/view.js";

function str(v: unknown, fallback = "unknown"): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Verbatim, required staking-copy lines (Copy truth rules). Rendered as-is. */
const REQUIRED_STAKING_LINES = [
  "Not a performance claim.",
  "Historical fee distributions are not forecasts.",
  "No known unresolved Critical or High findings after internal launch review.",
];

function unsignedDetail(tx: UnsignedTx): string[] {
  return [
    `Chain: ${tx.chainId}`,
    `To: ${tx.to}`,
    `Value: ${tx.value} wei`,
    `Calldata: ${tx.data}`,
    "This transaction is UNSIGNED. Review it and submit it with your own wallet.",
  ];
}

/** A data-only unsigned transaction-review block. signed:false is always shown. */
function unsignedView(tx: UnsignedTx, functionName: string, extra?: ViewBlock[]): ViewBlock[] {
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
    ...(extra ?? []),
  ];
}

function pausedToken(status: JsonRecord): { state: StateToken; label: string } {
  const p = status.paused;
  const val = p && typeof p === "object" ? (p as JsonRecord).value : p;
  if (val === true) return { state: "paused", label: "PAUSED (staking/injections)" };
  if (val === false) return { state: "active", label: "ACTIVE" };
  return { state: "unknown", label: "UNKNOWN" };
}

export async function stakeStatusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getStakingStatus();
  const detail = [
    `xHISS vault: ${str(status.vaultAddress, str(status.vault))}`,
    `Staking asset: ${str(status.stakingAsset, "HISS")}`,
    `Cooldown: ${str(status.cooldownSeconds ? String(status.cooldownSeconds) + "s" : undefined, "259200s (72h)")}`,
    ...REQUIRED_STAKING_LINES,
  ];
  const pause = pausedToken(status);
  const view: ViewBlock[] = [
    {
      kind: "status",
      state: pause.state,
      label: `xHISS ${pause.label}`,
      note: "live chain read · exits are never pausable",
    },
    {
      kind: "keyValue",
      title: "xHISS staking",
      rows: [
        {
          label: "xHISS vault",
          value: str(status.vaultAddress, str(status.vault)),
          token: "address",
          full: true,
        },
        { label: "Staking asset", value: str(status.stakingAsset, "HISS"), token: "value" },
        { label: "Cooldown", value: "72h (259200s), then a 2-day redeem window", token: "value" },
      ],
    },
    // Required staking copy — rendered VERBATIM (Copy truth rules).
    { kind: "panel", variant: "review", lines: REQUIRED_STAKING_LINES },
  ];
  return { summary: "xHISS staking status read.", data: status, detail, view, exitCode: EXIT.SUCCESS };
}

export async function stakePrepareCommand(client: HissClient, amount: string): Promise<CommandResult> {
  const tx = await client.prepareHissStake(amount);
  return {
    summary: `Prepared an UNSIGNED stake of ${amount} HISS. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
    view: unsignedView(tx, "stake", [
      {
        kind: "keyValue",
        rows: [
          { label: "Amount", value: `${amount} HISS`, token: "value" },
          {
            label: "Required approval",
            value: "ERC-20 approve(xHISS vault, amount) before staking",
            token: "warning",
          },
        ],
      },
    ]),
    exitCode: EXIT.SUCCESS,
  };
}

export async function stakeCooldownCommand(client: HissClient, xhissAmount: string): Promise<CommandResult> {
  const tx = await client.prepareXhissCooldown(xhissAmount);
  return {
    summary: `Prepared an UNSIGNED cooldown for ${xhissAmount} xHISS. Nothing was sent.`,
    data: tx,
    detail: unsignedDetail(tx),
    view: unsignedView(tx, "startCooldown", [
      {
        kind: "keyValue",
        rows: [
          { label: "xHISS", value: `${xhissAmount} xHISS`, token: "value" },
          { label: "Cooldown", value: "72h (259200s), then a 2-day redeem window", token: "muted" },
        ],
      },
    ]),
    exitCode: EXIT.SUCCESS,
  };
}

export async function stakeRedeemCommand(
  client: HissClient,
  xShares?: string,
  receiver?: string,
): Promise<CommandResult> {
  const tx = await client.prepareXhissRedeem(xShares, receiver);
  return {
    summary: "Prepared an UNSIGNED xHISS redeem within your open redeem window. Nothing was sent.",
    data: tx,
    detail: unsignedDetail(tx),
    view: unsignedView(tx, "redeem", [
      {
        kind: "panel",
        variant: "info",
        lines: ["Redeem is only valid within an open redeem window. Exits are never pausable."],
      },
    ]),
    exitCode: EXIT.SUCCESS,
  };
}
