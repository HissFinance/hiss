# Share-seconds

**Share-seconds** is the measure of depositor participation used to allocate the
[30% depositor leg](./depositor-rewards.md). It is the integral of a depositor's vault
**share balance over time** — a purely factual measure of how much, and how long, you
participated. It has **nothing to do with performance, PnL, or APY.**

## Definition

For each depositor, over an epoch window `[epochStart, epochEnd)`:

```
shareSeconds = Σ over intervals ( shares_held × seconds_held )
```

Each interval is a period of constant share balance, read from on-chain events. An
interval is **clipped** to the epoch window, so time held outside the epoch does not
count.

## Worked example

A depositor holds:

- 100 shares from `t0` to `t0 + 2 days`
- 300 shares from `t0 + 2 days` to `t0 + 7 days` (epoch end)

```
2 days = 172,800 s ;  5 days = 432,000 s
shareSeconds = 100 × 172,800 + 300 × 432,000
             = 17,280,000 + 129,600,000
             = 146,880,000  (share-seconds)
```

Their allocation of the 30% pool = `theirShareSeconds ÷ totalShareSeconds`, floor
divided. Depositing **more** and **earlier** increases share-seconds; withdrawing
reduces it going forward.

## Properties

- **Deterministic.** Same events → same share-seconds. Results are ordered by address
  ascending; floor division is used per depositor.
- **Zero-participation → no leaf.** A depositor with zero share-seconds gets no
  allocation.
- **Exact accounting.** The sum of allocations plus floor-division dust equals the pool
  exactly.
- **No performance inputs.** Share-seconds measures participation only. PnL/APY are not
  part of it — pinned at the type level.

## Why share-seconds

It rewards **actual, sustained deposit participation** rather than a snapshot (which is
gameable by depositing right before a checkpoint) or performance (which HISS never
rewards). Integrating over time makes brief, opportunistic deposits worth little and
sustained participation worth proportionally more.

## Computing it

`@hiss-finance/core` exposes `scoreDepositorShareDays(intervals, epochStart, epochEnd)`
and `allocateDepositorRewards(...)`. The indexer builds intervals from chain events; the
allocation is reproducible from those events.

## Related

- [Depositor rewards](./depositor-rewards.md) · [Epochs and vesting](./epochs-and-vesting.md)
