/**
 * `hiss lp ...` — Stock-Premium LP (HissLpManagerV1) commands.
 *
 * `lp status` / `lp fees` render the canonical, committed deployment + fee
 * facts from `@hiss-finance/core` (address, chain, artifact status, immutable
 * fee bounds, Safe owner/treasury). The manager is LAUNCHED PAUSED (inert): no
 * positions are enrollable and nothing is charged, so live per-position /
 * per-pool data is NOT available from the public read surface in this build.
 * Those subcommands render an honest UNKNOWN (exit 7) that points at the hosted
 * MCP / vault API rather than fabricating positions or pools. The prepare-*
 * flows are not exposed by the public SDK yet and refuse cleanly (unsigned,
 * nothing sent).
 */

import { HISS_LP_MANAGER_V1_DEPLOYMENT, HISS_LP_MANAGER_V1_EXPLORER_URL } from "@hiss-finance/core";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { KVRow, ViewBlock } from "../lib/view.js";

const D = HISS_LP_MANAGER_V1_DEPLOYMENT;

const PAUSED_NOTE =
  "HissLpManagerV1 is LAUNCHED PAUSED (inert): no positions are enrollable and no fee is charged. Live pause/fee/owner/treasury are always a fresh chain read — a failed read is UNKNOWN, never 'live' and never 'not deployed'.";

/** `hiss lp status` — the canonical LP manager deployment record. */
export function lpStatusCommand(): CommandResult {
  const rows: KVRow[] = [
    { label: "Contract", value: D.contract, token: "value" },
    { label: "Address", value: D.address, token: "address", full: true },
    { label: "Chain", value: D.chainId, token: "value" },
    { label: "Artifact status", value: D.status, token: "paused" },
    { label: "Explorer verified", value: String(D.explorerVerified), token: "value" },
    { label: "Owner (expected)", value: D.expectedOwner, token: "address", full: true },
    { label: "Treasury (expected)", value: D.expectedTreasury, token: "address", full: true },
    { label: "Fee policy", value: D.feePolicyVersion, token: "muted" },
    { label: "Fee (bps)", value: D.expectedFeeBps, token: "value" },
    { label: "Max fee (bps, immutable)", value: D.immutableMaxFeeBps, token: "value" },
  ];
  const view: ViewBlock[] = [
    { kind: "keyValue", title: "Stock-Premium LP — HissLpManagerV1", rows },
    { kind: "status", state: "paused", label: "DEPLOYED_PAUSED", note: "inert — nothing enrollable" },
    { kind: "panel", variant: "info", lines: [PAUSED_NOTE, `Explorer: ${HISS_LP_MANAGER_V1_EXPLORER_URL}`] },
  ];
  return {
    summary: `Stock-Premium LP manager ${D.contract} is ${D.status} on chain ${D.chainId}.`,
    data: D,
    detail: [
      `Contract: ${D.contract} (${D.address})`,
      `Chain: ${D.chainId} · status ${D.status}`,
      `Fee: ${D.expectedFeeBps} bps (immutable max ${D.immutableMaxFeeBps} bps)`,
      PAUSED_NOTE,
    ],
    view,
    exitCode: EXIT.SUCCESS,
  };
}

/** `hiss lp fees` — the immutable management-fee policy (realized LP fees only). */
export function lpFeesCommand(): CommandResult {
  const rows: KVRow[] = [
    { label: "Fee policy", value: D.feePolicyVersion, token: "value" },
    { label: "Management fee (bps)", value: D.expectedFeeBps, token: "value" },
    { label: "Immutable max (bps)", value: D.immutableMaxFeeBps, token: "value" },
    { label: "Applies to", value: "realized LP fees only", token: "muted" },
    { label: "Treasury", value: D.expectedTreasury, token: "address", full: true },
  ];
  return {
    summary: `LP management fee is ${D.expectedFeeBps} bps (immutable max ${D.immutableMaxFeeBps} bps) on realized LP fees.`,
    data: {
      feePolicyVersion: D.feePolicyVersion,
      feeBps: D.expectedFeeBps,
      maxFeeBps: D.immutableMaxFeeBps,
      appliesTo: "realized_lp_fees_only",
      treasury: D.expectedTreasury,
    },
    detail: [
      `Management fee: ${D.expectedFeeBps} bps`,
      `Immutable max: ${D.immutableMaxFeeBps} bps`,
      "The fee applies to realized LP fees only. No guaranteed yield or APY.",
    ],
    view: [
      { kind: "keyValue", title: "LP management fee", rows },
      {
        kind: "panel",
        variant: "info",
        lines: ["The fee is charged on realized LP fees only. Not a yield, not an APY, not a forecast."],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}

/**
 * The live-data LP subcommands. The manager is inert (paused) and no public
 * read surface for per-position / per-pool state ships in this build, so the
 * honest verdict is UNKNOWN (exit 7) — never a fabricated empty set.
 */
function lpUnknown(subject: string, extra?: string[]): CommandResult {
  return {
    summary: `LP ${subject} is UNKNOWN in this build — HissLpManagerV1 is ${D.status} and no public read surface for ${subject} ships here.`,
    data: {
      subject,
      available: false,
      managerStatus: D.status,
      manager: D.address,
      chainId: D.chainId,
      guidance: "Query the hosted HISS MCP (`hiss mcp status`) or the HISS vault API for live LP state.",
    },
    detail: [
      PAUSED_NOTE,
      `${subject} is not available from the public read surface in this build — reporting UNKNOWN.`,
      "Use `hiss mcp status` for the hosted MCP, or the HISS vault API, for live LP state.",
      ...(extra ?? []),
    ],
    view: [
      {
        kind: "status",
        state: "unknown",
        label: `LP ${subject.toUpperCase()} UNKNOWN`,
        note: `manager ${D.status} — live read via hosted MCP`,
      },
      { kind: "panel", variant: "warning", title: "Not available in this build", lines: [PAUSED_NOTE] },
    ],
    exitCode: EXIT.PARTIAL,
  };
}

export function lpScanCommand(): CommandResult {
  return lpUnknown("scan");
}
export function lpPoolsCommand(): CommandResult {
  return lpUnknown("pools");
}
export function lpPositionsCommand(): CommandResult {
  return lpUnknown("positions");
}
export function lpPositionCommand(id: string): CommandResult {
  return lpUnknown(`position ${id}`);
}

/**
 * The prepare-* LP flows. The public SDK does not expose LP mint/collect/close
 * calldata in this build, so we refuse cleanly — unsigned, nothing prepared,
 * nothing sent — rather than fabricate a transaction.
 */
function lpPrepareUnavailable(action: string): CommandResult {
  return {
    summary: `LP ${action} is not available in this build. Nothing was prepared and nothing was sent.`,
    data: {
      action,
      available: false,
      signed: false,
      liveTransactionSent: false,
      managerStatus: D.status,
      manager: D.address,
      guidance: "LP prepare flows are not exposed by the public SDK yet; the manager is launched paused.",
    },
    detail: [
      `The public SDK does not expose LP ${action} calldata in this build.`,
      PAUSED_NOTE,
      "No unsigned transaction was produced. HISS never signs or submits.",
    ],
    view: [
      {
        kind: "panel",
        variant: "warning",
        title: `LP ${action} unavailable`,
        lines: [
          `The public SDK does not expose LP ${action} in this build.`,
          "No unsigned transaction was produced (signed:false, nothing sent).",
          PAUSED_NOTE,
        ],
      },
    ],
    exitCode: EXIT.PARTIAL,
  };
}

export function lpPrepareMintCommand(): CommandResult {
  return lpPrepareUnavailable("prepare-mint");
}
export function lpPrepareCollectCommand(): CommandResult {
  return lpPrepareUnavailable("prepare-collect");
}
export function lpPrepareCloseCommand(): CommandResult {
  return lpPrepareUnavailable("prepare-close");
}
