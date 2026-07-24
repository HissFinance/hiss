# One-sided range ladders

## What a one-sided ladder is

A single-sided USDG range below the pool price is a **bounded buy ladder**: as the
price falls through the range, USDG is converted into the Stock Token, rung by
rung. The position may accrue LP fees while doing so, and its inventory value may
fall at the same time. It is a bounded, uncertain strategy — never arbitrage, never
a guaranteed return. The mirror template sells Stock Token into a discount.

## Templates and postures

- Templates (`LadderTemplate`): `PREMIUM_USDG_BUY_LADDER` (USDG below pool price)
  and `DISCOUNT_TOKEN_SELL_LADDER` (Stock Token above pool price).
- Postures (`LadderPosture`): `OBSERVE_ONLY`, `SHADOW`, `PREPARE_ONLY`. The posture
  controls how far the flow goes — observe (no capital), shadow (simulate, no tx),
  or prepare-only (typed unsigned package).

## Construction (`buildLadder`)

`buildLadder(req)` returns a `LadderPlan` or a typed `LadderRejection`. It maps a
target price band to v3 ticks (`tickForPriceUsdE18`, `priceAtTickUsdE18`, honoring
the pool's `usdgIsToken0` orientation and `tickSpacing`), distributes notional
across rungs, and attaches gas and withdrawal assumptions.

## Capacity is dynamically bounded

Capacity is bounded by **usable depth right now**, probed with simulated swaps —
NOT by TVL. The cap moves as depth moves. As size approaches the usable depth, the
order becomes the market; at or beyond the cap the estimate is a conservative
under-bound, not authorized capacity (`OVER_CAPACITY`). Pools are thin and
single-venue (Uniswap v3 on chain 4663) — never described as deep, dependable, or
always-available.

## Rejections are typed, never silent

A ladder request that cannot be honored returns a typed `LadderRejection` with a
`reason` and detail (bad orientation, unpriceable band, zero/UNKNOWN capacity,
etc.). Fail-closed: the builder refuses rather than emitting an unbounded or
guessed ladder.

## Costs travel with the plan

Every previewed ladder states, before any signature is requested: its capacity
ceiling, its fuses, its worst-case inventory path, and its full cost model (see
`premium-math.md` and the eight-line P&L). Fees are shown beside the signed net —
never alone.
