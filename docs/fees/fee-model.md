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

## Verified HISS-token trading fee split (HISS Reward Method V2)

High-confidence, chain-classified HISS-token trading fees are split
**50/15/15/10/10**:

| Leg                | Share | Recipient                             |
| ------------------ | ----- | ------------------------------------- |
| xHISS stakers      | 50%   | staking vault (`injectRewards`)       |
| Vault providers    | 15%   | vault-provider rewards distributor    |
| Vault contributors | 15%   | vault-contributor vesting distributor |
| Treasury Safe      | 10%   | absorbs floor-division dust           |
| Economic burn      | 10%   | canonical dead address (`0x…dEaD`)    |

The five legs sum to exactly 100. The classifier and the split both fail
closed: low-confidence fee sources are never distributed. **Vault contributors**
is the current name for the former **depositor** reward cohort (methodology
unchanged); **V1** (50/30/10/10, no burn) is historical.

The economic-burn leg transfers $HISS to the dead address
`0x000000000000000000000000000000000000dEaD` — it leaves circulation but does
**not** reduce `HISS.totalSupply`. See [reward split](../rewards/reward-split.md).

## Claimed WETH

Claimed WETH routes **100%** to the Treasury Safe. It is never split and never
routed to providers or stakers.

## State chain

Planned ≠ funded ≠ claimable. Split plans are data; funding is owner-gated and
chain-verified; staker value moves only via `injectRewards` on the deployed
vault.

See also: [reward split](../rewards/reward-split.md) ·
[honesty guardrails](../guardrails/execution-claims.md).
