# Premium math (amount-aware, direction-specific)

## Direction

Premium is never a single scalar — it is direction- and size-specific.

- `USDG_TO_TOKEN` — the buy side: an exact USDG notional in, simulated Stock-Token
  out (`simulateBuy`). Reference side = the ask.
- `TOKEN_TO_USDG` — the sell side: an exact Stock-Token clip in, simulated USDG out
  (`simulateSell`). Reference side = the bid.

## Multiplier applied exactly once (feed side only)

The Stock-Token price multiplier is applied a single time to the **reference feed**
via the mesh producer's own `adjustedFeedE18` (the `adjustReferenceSide` path in
`premium.ts`). This guarantees parity with the mesh (INV-MULT-1). Pool marks are
NEVER routed through the multiplier. Applying it twice, or applying it to a pool
mark, is a correctness defect — not a rounding choice.

## Signed premium formula

```
signed premium bps = ((executable_price / reference_price) - 1) * 10000
```

Computed with bigint truncation toward zero on E18 values. Positive = the
executable pool price sits above the real-price reference (a premium); negative =
below (a discount). `expectedImpactBps` is the divergence of the executable price
from the pool spot — the size's own market impact, reported separately.

## Confidence (fail-closed)

`computePremiumPoint` returns a `confidence`:

- `EXECUTION_GRADE` — fresh reference, execution-grade mark, capacity known and not
  exceeded.
- `DISPLAY_ONLY` — the producer mark is display-only (NAV alive, execution not
  authorized).
- `OVER_CAPACITY` — the notional exceeds the dynamic safe-notional (the capacity
  ceiling); the single-range estimate is a conservative under-bound and is NOT
  authorized capacity.
- `UNKNOWN` — reference quote, pool output, or dynamic capacity could not be
  evaluated. Fail-closed: capacity UNKNOWN is treated as UNKNOWN, never as zero and
  never as unlimited.
- `HALTED` — the mesh bundle rejected the asset (e.g. corporate action, oracle
  pause); the reason is surfaced.

Never upgrade a confidence to fill a gap. A proven-zero capacity can never be
execution-grade.

## Reference vs executable

The real-price reference is the truth anchor; the executable price is what a
specific size could actually get on the thin, single-venue pool at this moment.
They are different numbers and are never presented as a parity or a conversion.
Every reference carries a source stamp and an age; a stale reference is not a fill.
See `hiss-price-mesh` for the same separation across rails.
