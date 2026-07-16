# The HISS reward flywheel

The flywheel routes **verified $HISS trading fees** to the people who use the
protocol — stakers, depositors, and providers — plus the Treasury. This page is the
complete mechanism. It is a **mechanical routing of fees**, not a yield product:
**Not a performance claim. Historical fee distributions are not forecasts.**

## The one figure that gets split

Only the **eligible amount** of a **verified, high-confidence $HISS trading-fee
claim** is ever split (see [$HISS token fees](./hiss-token-fees.md)). The 15% creator
premint, WETH, pre-existing balances, manual transfers, and unclassified deltas are
excluded upstream and rejected again at the split. If confidence is not high, nothing
splits — the system **fails closed**.

## The 50 / 30 / 10 / 10 split

Basis points of the eligible $HISS (sum = 10,000):

| Leg               | Share               | Recipient                                | Deployed?                                          |
| ----------------- | ------------------- | ---------------------------------------- | -------------------------------------------------- |
| xHISS stakers     | **50%** (5,000 bps) | xHISS staking vault (ERC-4626 injection) | Yes — `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` |
| Depositor vesting | **30%** (3,000 bps) | Depositor vesting distributor            | **Not yet** → recipient `null`                     |
| Provider rewards  | **10%** (1,000 bps) | Provider rewards distributor             | **Not yet** → recipient `null`                     |
| Treasury          | **10%** (1,000 bps) | Treasury Safe (2-of-3)                   | Yes — `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` |

The math is pure bigint floor-division per leg. The **treasury leg absorbs the
floor-division dust**, so the four legs sum **exactly** to the input (re-checked at
runtime). **Claimed WETH is never part of this split — 100% goes to the Treasury
Safe.**

> Nothing moves against a `null` recipient. Until the depositor and provider
> distributors are deployed and verified, those legs are planned data only.

## The xHISS leg — 50%

The 50% staker leg becomes an ERC-4626 **reward injection** into the xHISS vault via
`injectRewards` (injector-gated by the Treasury Safe). The injection **drips linearly
over 24 hours**, raising the xHISS-to-$HISS exchange rate for everyone staked.
Injections revert if there are **zero stakers**. See [xHISS](../staking/xhiss.md) and
[Reward injections](../staking/reward-injections.md).

## The depositor leg — 30% (share-seconds)

The depositor pool is allocated **pro-rata by share-seconds**: each depositor's vault
**share balance integrated over the epoch** (Σ shares × seconds held), read from chain
events. There are deliberately **no PnL, APY, or performance inputs** — this is a
deposit-participation incentive, never a performance claim. Allocations carry a
**30-day linear vest**. Details: [Depositor rewards](../rewards/depositor-rewards.md)
and [Share-seconds](../rewards/share-seconds.md).

## The provider leg — 10% (facts-only, grouped, capped)

The provider pool rewards **eligible provider groups** (a provider's multiple vaults
count as one group) using **facts-only** scoring — **no PnL/APY/rank/volatility
inputs anywhere** (enforced by a runtime forbidden-key guard). The per-group score:

| Component         | Weight  | Basis                                                                                                                             |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Equal             | **40%** | Split equally among eligible groups                                                                                               |
| External TVL-days | **30%** | Group external TVL × days, concave curve, optional cap                                                                            |
| Retention         | **20%** | 50% external-capital cohort retention + 50% median external depositor age                                                         |
| Operational       | **10%** | 30% maintenance-on-time + 25% receipt freshness + 20% no provider-fault pause + 15% docs current + 10% oracle/adapter/risk health |

A **dominance cap of 25%** of the pool per group is applied after the raw score, with
water-fill redistribution among under-cap groups; anything unplaceable **rolls over to
the next provider epoch** (never to the capped group, never to treasury). Provider
allocations carry a **90-day** vest. Eligibility is facts-only and a group must have
its own wallets declared in the exclusion set (anti-self-dealing). Details:
[Provider rewards](../rewards/provider-rewards.md).

## Epoch lifecycle: planned ≠ funded ≠ vesting ≠ claimable

Rewards move through an explicit, gated lifecycle. Nothing is claimable early.

```
provisional → final → challenge → funded → vesting → claimable → claimed
                                        └→ rolled_over (unclaimed remainder)
```

- **Weekly provisional checkpoints** (4–5 per monthly epoch) are computed but
  **never claimable**.
- **Monthly finalization** produces a deterministic, reproducible epoch-score
  artifact (merkle roots + content hash) from source events.
- A **7-day public challenge window** follows publication. Epochs in the challenge
  window are **not claimable**; a sustained challenge forces recomputation.
- **Funding** requires the **2-of-3 Treasury Safe** and happens only after the
  challenge window.
- **Vesting** is linear (30 days depositor, 90 days provider); only vested,
  funded, past-challenge amounts are **claimable**.
- **Rollover:** unclaimed depositor remainder → treasury after the deadline;
  unclaimed/uncapped provider remainder → the next epoch.

Full lifecycle and vesting math: [Epochs and vesting](../rewards/epochs-and-vesting.md).

## Worked split example

Suppose a claim yields **1,000 $HISS** of **verified eligible** trading fees:

```
xHISS stakers      50%  = 500 $HISS   → 24h linear injection into the xHISS vault
Depositor vesting  30%  = 300 $HISS   → planned to the depositor distributor (null today)
Provider rewards   10%  = 100 $HISS   → planned to the provider distributor (null today)
Treasury           10%  = 100 $HISS   → Treasury Safe (plus any floor-division dust)
                          ─────────
                          1,000 $HISS  (legs sum EXACTLY)
```

With the depositor and provider distributors not yet deployed, their legs remain
**planned data** (recipient `null`) — nothing moves against them. The xHISS and
treasury legs are live-capable. This is a routing illustration, **not a forecast**.

## Why the flywheel

Trading $HISS generates fees → verified fees flow to stakers, depositors, and
providers who use the protocol → aligned participants deepen usage → more activity.
Each step is gated and evidence-based: **planned is data, funded is owner-authorized
and chain-verified, claimable requires vesting past the challenge window.**

## Treasury assets are separate

Treasury holdings (including 100% of claimed WETH and the treasury split legs) are the
protocol's own assets. They are **not depositor funds** and are **not** part of any
further reward split beyond the explicit treasury legs shown above.
