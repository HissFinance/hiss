/**
 * `hiss rewards ...` — read-only reward status reporters. These commands
 * REPORT committed state; they never score, fund, publish a root, or move
 * value. planned ≠ funded ≠ claimable.
 */

import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { HissClient, JsonRecord } from "../lib/types.js";
import type { ViewBlock } from "../lib/view.js";

const REWARD_NOTE =
  "Read-only report. planned ≠ funded ≠ claimable. Not a performance claim; historical fee distributions are not forecasts.";

/** Split legs (bps) → a table. This is the PLANNED split — funding is separate. */
function splitTable(model: JsonRecord | undefined): ViewBlock | null {
  const legs = model && typeof model.legs === "object" ? (model.legs as JsonRecord) : undefined;
  if (!legs) return null;
  const labels: Record<string, string> = {
    xhissStakersBps: "xHISS stakers",
    vaultProvidersBps: "Vault providers",
    vaultContributorsBps: "Vault contributors",
    treasuryBps: "Treasury",
    burnBps: "Economic burn (dead address)",
  };
  const rows = Object.entries(labels)
    .filter(([k]) => typeof legs[k] === "number")
    .map(([k, label]) => [label, `${(legs[k] as number) / 100}%`]);
  return {
    kind: "table",
    title: `Planned split (${String(model?.version ?? "reward-split")})`,
    columns: [{ header: "Leg" }, { header: "Share", numeric: true }],
    rows,
  };
}

export async function rewardsStatusCommand(client: HissClient): Promise<CommandResult> {
  const status = (await client.getRewardStatus()) as JsonRecord;
  const model = status.model && typeof status.model === "object" ? (status.model as JsonRecord) : undefined;
  const view: ViewBlock[] = [];
  const table = splitTable(model);
  if (table) view.push(table);
  // planned and funded are kept VISUALLY SEPARATE — never one row implying both.
  view.push({
    kind: "keyValue",
    title: "Funding (separate from the plan)",
    rows: [
      { label: "Planned", value: "yes (split constants above)", token: "info" },
      { label: "Funded", value: status.funded == null ? null : String(status.funded), token: "warning" },
      { label: "Claimable", value: null, token: "muted" },
    ],
  });
  view.push({ kind: "panel", variant: "warning", lines: [REWARD_NOTE] });
  return {
    summary: "Reward status read.",
    data: status,
    detail: [REWARD_NOTE],
    view,
    exitCode: EXIT.SUCCESS,
  };
}

export async function rewardsContributorCommand(client: HissClient, address: string): Promise<CommandResult> {
  const record = await client.getVaultContributorReward(address);
  return {
    summary: `Vault-contributor reward status read for ${address}.`,
    data: record,
    detail: [
      "Vault contributors is the current name for the former depositor cohort. The vault-contributor vesting distributor recipient may be null (not deployed) — nothing is claimable against null.",
      REWARD_NOTE,
    ],
    view: [
      { kind: "keyValue", rows: [{ label: "Account", value: address, token: "address", full: true }] },
      {
        kind: "panel",
        variant: "warning",
        lines: [
          "The vault-contributor distributor recipient may be null (undeployed) — nothing is claimable against null.",
          REWARD_NOTE,
        ],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}

export async function rewardsProviderCommand(client: HissClient, groupId: string): Promise<CommandResult> {
  const record = await client.getProviderReward(groupId);
  return {
    summary: `Provider reward status read for group ${groupId}.`,
    data: record,
    detail: ["Eligibility is facts-only — never PnL, APY, rank, or return-shaped inputs.", REWARD_NOTE],
    view: [
      { kind: "keyValue", rows: [{ label: "Group", value: groupId, token: "value" }] },
      {
        kind: "panel",
        variant: "warning",
        lines: ["Eligibility is facts-only — never PnL, APY, rank, or return-shaped inputs.", REWARD_NOTE],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}
