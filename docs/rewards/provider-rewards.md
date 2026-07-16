# Provider rewards

The **10%** provider leg of the [reward flywheel](../fees/reward-flywheel.md) rewards
**eligible provider groups** — the creators/operators who run vaults — using
**facts-only** scoring. There are **no PnL, APY, return, rank, volatility, or turnover
inputs anywhere**, enforced by a runtime forbidden-key guard. Rewards recognize
**operations and participation, never predicted performance.**

> The provider rewards distributor is **not yet deployed**; in split plans its
> recipient is `null` and **nothing moves against it**. Do not describe provider
> rewards as live, funded, or claimable.

## Grouping

A provider's **multiple vaults count as one group**. The equal-share component is per
group, never per vault, so spinning up more vaults does not multiply rewards.

## Eligibility (facts-only)

A group must satisfy **all** of these facts to be eligible (an ineligible group is
simply absent from the merkle root → zero):

- Created via the canonical `VaultFactory`; registered in the provider registry;
  payout address verified.
- Active strategy; disclosures current; receipts current; strategy notices current;
  required maintenance done when due; not abandoned.
- Not paused for provider fault; no unresolved Critical/High incident; no fake/off-chain
  TVL.
- Meets a minimum operating age (**14 days**) and any minimum qualifying external
  TVL-days.
- **Own wallets declared in the exclusion set** — a group whose own addresses are not
  excluded is refused (anti-self-dealing spine).

## Scoring — 40 / 30 / 20 / 10

The per-group score is the sum of four component sub-pools of the provider pool:

| Component             | Weight  | Basis                                                                                                                              |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Equal**             | **40%** | Split equally among eligible groups.                                                                                               |
| **External TVL-days** | **30%** | Group external TVL × days, concave (sqrt) curve, optional cap.                                                                     |
| **Retention**         | **20%** | 50% external-capital cohort retention + 50% median external depositor age.                                                         |
| **Operational**       | **10%** | 30% maintenance-on-time + 25% receipt freshness + 20% no provider-fault pause + 15% docs current + 10% oracle/adapter/risk health. |

All inputs are **operational facts**, never performance figures.

## Dominance cap — 25%

After the raw score, a **dominance cap of 25%** of the pool per group is applied with
**water-fill redistribution** among under-cap groups. Anything unplaceable **rolls over
to the next provider epoch** — never to the capped group, never to the treasury. This
stops any single provider from absorbing the pool.

## Vesting

Provider allocations carry a **90-day linear vest** (`PROVIDER_VEST_SECONDS =
7,776,000s`). On-chain 90-day vesting is a modelled/metadata schedule pending the
provider-distributor vesting delta; the merkle leaf is `(registryKey, epochId,
amount)`. See [Epochs and vesting](./epochs-and-vesting.md).

## Revocation is narrow and objective

Only **unvested** provider rewards may be frozen, and only under an **exhaustive list of
objective conditions** (verified fraud, exploit, misappropriation, falsified receipts,
malicious bypass, provider-fault emergency pause, proven undisclosed prohibited
self-dealing), and only via a **2-of-3 Treasury Safe** authorization with a public
receipt. **Already-vested rewards are never revocable.** Poor performance, low returns,
drawdown, or high volatility can **never** trigger revocation — they are explicitly
excluded.

## Reading status

```ts
const prov = await hiss.rewards.readProviderStatus({ epochId });
// eligibility reasons, components, cap applied, allocation, vested, claimable
```

MCP: `hiss_get_provider_reward_status`, `hiss_plan_provider_rewards` (plan data only).

## Honesty rules

- Provider rewards are **not** yield or a performance reward — they recognize
  facts-only operations.
- **Planned ≠ funded ≠ vesting ≠ claimable.** With the distributor undeployed, the leg
  is planned data only.
- A failed read is **unknown**.
