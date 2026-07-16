// SPDX-License-Identifier: Apache-2.0
/**
 * Reward epoch lifecycle types + the legal state-transition graph.
 *
 * State chain, always: planned != funded != claimable. A score is data; a
 * challenge window must close and the Safe must authorize funding before any
 * vested amount is claimable. Nothing here moves tokens.
 */

export type RewardEpochState =
  | "provisional" // weekly checkpoint; not final, not claimable
  | "final" // monthly score finalized deterministically
  | "challenge" // published; inside the challenge window (NOT claimable)
  | "funded" // Safe-authorized + on-chain funded after the challenge window
  | "vesting" // linear vesting underway; some portion may be claimable
  | "claimable" // vested-but-unclaimed amounts exist and are claimable
  | "claimed" // fully claimed
  | "rolled_over"; // unclaimed remainder returned (depositor->treasury / provider->next epoch)

export const REWARD_EPOCH_STATES: readonly RewardEpochState[] = [
  "provisional",
  "final",
  "challenge",
  "funded",
  "vesting",
  "claimable",
  "claimed",
  "rolled_over",
];

const TRANSITIONS: ReadonlySet<string> = new Set([
  "provisional>final",
  "final>challenge",
  "challenge>funded",
  "challenge>final", // a sustained challenge forces recomputation
  "funded>vesting",
  "funded>rolled_over",
  "vesting>claimable",
  "vesting>rolled_over",
  "claimable>claimed",
  "claimable>rolled_over",
]);

export function canTransitionEpochState(from: RewardEpochState, to: RewardEpochState): boolean {
  return TRANSITIONS.has(`${from}>${to}`);
}

export function assertEpochStateTransition(from: RewardEpochState, to: RewardEpochState): void {
  if (!canTransitionEpochState(from, to)) {
    throw new Error(`illegal reward-epoch state transition ${from} -> ${to}`);
  }
}

export type EpochWindow = {
  startTime: number;
  endTime: number;
  startBlock?: number;
  endBlock?: number;
};

/** A reward epoch's public lifecycle descriptor. */
export type RewardEpoch = {
  epochId: number;
  state: RewardEpochState;
  window: EpochWindow;
  /** Deterministic content hash of the finalized score, when final or later. */
  scoreHash?: string;
  publication?: {
    challengeWindowStart: string;
    challengeWindowEnd: string;
    publishedAt?: string;
  };
};

/** Gate flags a claim must pass BEFORE any vested amount is claimable. */
export type ClaimGate = {
  funded: boolean;
  challengeWindowClosed: boolean;
  open: boolean;
};

/** True only when every claim gate is satisfied. */
export function claimGateOpen(gate: ClaimGate): boolean {
  return gate.funded && gate.challengeWindowClosed && gate.open;
}
