# Vault-contributor rewards

> **Vault contributors** is the current name for the former **depositor** reward
> cohort. The allocation methodology is unchanged — this page documents it under
> the current name.

The **15%** vault-contributor leg of the [reward flywheel](../fees/reward-flywheel.md)
is allocated to vault contributors **pro-rata by [share-seconds](./share-seconds.md)** —
the integral of each contributor's vault-share balance over the epoch. There are
deliberately **no PnL, APY, or performance inputs**: this is a
**deposit-participation incentive, never a performance claim.**

> The vault-contributor vesting distributor is **not yet deployed**; in split plans its
> recipient is `null` and **nothing moves against it**. Do not describe
> vault-contributor rewards as live, funded, or claimable.

## How allocation works

1. **Measure participation.** For each contributor, integrate share balance over the
   epoch window: `Σ shares × seconds held` (clipped to the epoch). See
   [share-seconds](./share-seconds.md).
2. **Allocate pro-rata.** Each contributor's share of the 15% pool =
   `contributorShareSeconds ÷ totalShareSeconds`, floor-divided.
3. **Dust.** Floor-division remainder stays in the distributor and, after the claim
   deadline, **rolls over to the Treasury** (`rolloverUnclaimed`).
4. **Vest.** Each allocation carries a **30-day linear vest** window
   (`VAULT_CONTRIBUTOR_VEST_SECONDS = 2,592,000s`), mirrored exactly on-chain.

The math is pure bigint, deterministic (address-ascending order), and the sum of
allocations plus dust equals the pool **exactly**.

## Vesting and claiming

- **Linear 30-day vest.** `vested = 0` before start, `total` at/after end, linear in
  between — mirroring the distributor's `vestedAmount` so off-chain and on-chain agree.
- **Claim gate.** Nothing is claimable unless the epoch is **funded**, the **7-day
  challenge window has closed**, and the epoch is still **open**. Claimable-now =
  `vested − alreadyClaimed`, floored at 0.
- **Merkle claims.** Each contributor is a leaf `(contributor, epochId, totalAmount,
vestStart, vestEnd)`; claims are proven against the epoch's merkle root.

See [Epochs and vesting](./epochs-and-vesting.md).

## What is excluded

- **No performance inputs.** PnL/APY/return are not part of scoring — pinned at the
  type level and guarded at runtime.
- **Excluded addresses.** The exclusion set (creator/self/deployer wallets, etc.) is
  applied so reward flows are not gamed by insiders.

## Reading status

```ts
const c = await hiss.rewards.readVaultContributorStatus({ epochId });
// pool, your share-seconds, allocation, vested, claimable (0 until funded & past challenge)
```

MCP: `hiss_get_reward_status` (reports the vault-contributor leg among the reward-split
state). Contributor-specific detail beyond that is HTTP-only.

## Honesty rules

- Vault-contributor rewards are **not** yield, APY, dividends, or passive income.
- **Planned ≠ funded ≠ vesting ≠ claimable.** With the distributor undeployed, the leg
  is planned data only.
- A failed read is **unknown**, never "claimable" and never "none".
