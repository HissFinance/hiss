/**
 * `hiss rewards ...` — read-only reward status reporters. These commands
 * REPORT committed state; they never score, fund, publish a root, or move
 * value. planned ≠ funded ≠ claimable.
 */

import type { CommandResult } from "../lib/output.js";
import type { HissClient } from "../lib/types.js";

const REWARD_NOTE =
  "Read-only report. planned ≠ funded ≠ claimable. Not a performance claim; historical fee distributions are not forecasts.";

export async function rewardsStatusCommand(client: HissClient): Promise<CommandResult> {
  const status = await client.getRewardStatus();
  return {
    summary: "Reward status read.",
    data: status,
    detail: [REWARD_NOTE],
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
  };
}

export async function rewardsProviderCommand(client: HissClient, groupId: string): Promise<CommandResult> {
  const record = await client.getProviderReward(groupId);
  return {
    summary: `Provider reward status read for group ${groupId}.`,
    data: record,
    detail: ["Eligibility is facts-only — never PnL, APY, rank, or return-shaped inputs.", REWARD_NOTE],
  };
}
