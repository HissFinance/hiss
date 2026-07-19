# $HISS token trading fees

This is a **separate fee system** from [vault fees](./vault-fees.md). It concerns
trading of the **$HISS token** itself, not vault deposits. A verified portion of
these fees powers the [reward flywheel](./reward-flywheel.md).

- **$HISS token address (chain 4663):** `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3`
  (18 decimals).

## Source: the Bankr / Doppler launch pool

$HISS launched with liquidity on a Uniswap V4 pool via the Bankr/Doppler launch
mechanism. Trading that pool generates protocol fees.

- **Swap fee:** **0.7%** on the Uniswap V4 pool.
- **Launch split of the swap fee:** **95% creator / 5% Doppler**.
- **Fee accrual currencies:** fees accrue in **$HISS** and in **WETH** (the two sides
  of the pool).
- **Contract-enforced vs policy:** the pool and launch mechanism (external, Bankr/
  Doppler) enforce the swap fee and its 95/5 split. HISS does not set these.
- **Caveat:** always verify the current pool configuration on-chain before relying on
  it — external launch parameters can differ from any secondary description.

## The 15% creator premint is always excluded

The launch includes a **15% creator premint** of $HISS that **vests over 2 years with
a 30-day cliff**. This premint is **always excluded from reward flows** — it is never
part of any split, never counted as a "trading fee", and never routed to stakers,
vault contributors, or vault providers. Excluding it is enforced upstream and
re-checked at the split.

## HISS-side vs WETH-side

The two accrual currencies are treated differently:

| Side                                                       | Policy                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **$HISS-side** (the creator's share of $HISS trading fees) | The **verified** portion is split by the reward flywheel **50 / 15 / 15 / 10 / 10**.           |
| **WETH-side** (claimed WETH fees)                          | **100% to the Treasury Safe.** Never split, never sent to stakers, contributors, or providers. |

## "Verified" is doing real work

Only **verified $HISS trading fees** enter the split. Verification is a high-confidence
on-chain classification that **fails closed**: anything that is not a positive,
high-confidence, classified $HISS trading-fee amount is excluded — including the
creator vesting premint, WETH, pre-existing balances, manual transfers, and
unclassified deltas. If the classifier is not confident, nothing is split.

- **Where verifiable:** the classification and split are pure, deterministic functions
  in `@hiss-finance/core` (`hiss-fees` and `hiss-rewards`); the eligible amount is the
  only figure ever split.
- **Contract-enforced vs policy:** classification and split planning are off-chain,
  reproducible **policy** with a keccak plan hash; **funding** is owner-gated and
  chain-verified; value only moves to stakers via an on-chain injection.

## Claim mechanics

1. **Accrue.** Trading the pool accrues fees in $HISS and WETH.
2. **Claim.** Fees are claimed from the pool to the creator/treasury side (an on-chain
   event).
3. **Classify.** Each claim is classified; only the high-confidence, positive $HISS
   trading-fee portion is _eligible_.
4. **Plan.** The eligible $HISS is split 50/15/15/10/10 into a **plan** (data, with a
   plan hash). WETH is planned 100% to the Treasury Safe.
5. **Fund.** Funding is owner-gated (2-of-3 Treasury Safe) and requires the exact plan
   hash — **planned ≠ funded**.
6. **Distribute.** The xHISS leg becomes a staking reward injection; other legs route
   to their distributors (some of which are not yet deployed — see caveats below).

## The split at a glance

```
Verified $HISS trading fee (eligible amount only)
  ├─ 50%  → xHISS stakers          (ERC-4626 reward injection)
  ├─ 15%  → vault providers        (facts-only scoring, 90-day vesting)
  ├─ 15%  → vault contributors     (share-seconds, 30-day vesting)
  ├─ 10%  → Treasury Safe          (absorbs floor-division dust; legs sum EXACTLY)
  └─ 10%  → economic burn          (dead address 0x…dEaD; totalSupply NOT reduced)

Claimed WETH → 100% Treasury Safe (never split)
```

Full mechanism, scoring, epochs, and vesting: [Reward flywheel](./reward-flywheel.md)
and the [rewards guide](../rewards/index.md).

## Caveats

- **Distributor deployment.** The vault-contributor vesting distributor and the
  vault-provider distributor are **not deployed yet**; in split plans their recipients
  are `null` and **nothing moves against a null recipient**. Do not describe those legs
  as live, funded, or claimable. The xHISS staking vault, the Treasury Safe, and the
  economic-burn dead address **are** live.
- **Not a forecast.** Historical or hypothetical fee figures are **not forecasts and
  not performance claims**. Fee income depends on trading activity that HISS does not
  control.
- **No holder revenue share.** Nothing here is a dividend, profit-participation
  instrument, or holder-reward entitlement. The split is a mechanical routing of
  verified fees to program participants, gated at every step.
