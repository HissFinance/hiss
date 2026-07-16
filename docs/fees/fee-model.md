# HISS Fee Model

This page describes the public, mechanical fee parameters for HISS Finance.
The numbers here are validated in CI against the canonical constants table
(`scripts/canonical/fee-constants.ts`) by the `check:fee-docs` guard — if any
figure below drifts from that table, CI fails.

> Not a performance claim. Historical fee distributions are not forecasts.

## Launch pool economics

- The $HISS Uniswap V4 pool charges a **0.7% swap fee** (**70 bps**).
- Launch fees are split **95%** to the creator and **5%** to Doppler.
- Fees accrue in $HISS and WETH.
- The 15% creator premint vests over 2 years with a 30-day cliff and is
  **always excluded** from reward flows.

## Verified HISS-token trading fee split

High-confidence, chain-classified HISS-token trading fees are split
**50/30/10/10**:

| Leg               | Share | Recipient                       |
| ----------------- | ----- | ------------------------------- |
| xHISS stakers     | 50%   | staking vault (`injectRewards`) |
| Depositor vesting | 30%   | depositor vesting distributor   |
| Provider rewards  | 10%   | provider rewards distributor    |
| Treasury Safe     | 10%   | absorbs floor-division dust     |

The four legs sum to exactly 100. The classifier and the split both fail
closed: low-confidence fee sources are never distributed.

## Claimed WETH

Claimed WETH routes **100%** to the Treasury Safe. It is never split and never
routed to providers or stakers.

## State chain

Planned ≠ funded ≠ claimable. Split plans are data; funding is owner-gated and
chain-verified; staker value moves only via `injectRewards` on the deployed
vault.

See also: [reward split](../rewards/reward-split.md) ·
[honesty guardrails](../guardrails/execution-claims.md).
