# Market and venue truth

The Stock-Premium LP Manager reads a LIVE venue, not a fixture. Every number a
tool returns is either a real chain-4663 read or an honest UNKNOWN — never a
fabricated value and never UNKNOWN rendered as zero.

## The venue is 24/7, the reference is not

- The Uniswap-v3-style pools on chain 4663 trade continuously. There is no
  calendar closure of the pool. The REAL stock exchange, however, closes — so
  the reference price behind a premium can be `CLOSED` or a stale `DAILY_MARK`.
- A premium is only meaningful against a VERIFIED reference. With no fresh,
  provenance-carrying reference, the premium is reported UNKNOWN. Pool spot,
  TWAP, and depth stay live regardless; the premium does not get invented.

## Verified pools only

- A pool is usable only when its identity is proven: CREATE2 address
  recomputation from `(factory, salt, POOL_INIT_CODE_HASH)`, the canonical
  factory pin, token-identity match, and fee/tick-spacing agreement. Impostor
  periphery with canonical-sounding names is rejected, regardless of its
  explorer label.
- Discovery is DYNAMIC: the set of assets and pools is read from the live
  registry, never a hard-coded symbol count. New verified pools appear without a
  code change; unverified ones are surfaced as UNVERIFIED (degraded), not hidden.

## Quote asset decides the UNIT — a `$` is not always valid

This is the single most common mispricing trap, and the engine handles it in the
PRODUCER (`priceFromSqrt`), not per surface:

- A price derived from a pool `sqrtPriceX96` is expressed in the pool's QUOTE
  units. A USD figure is valid ONLY for a `$1`-face USDG-quoted pool.
- A WETH-quoted pool yields a price in WETH per whole token. Presenting that as
  `$` would be an invented USD number, mis-scaled by the decimals gap
  (USDG has 6 decimals, WETH has 18 — a naive USD scale is off by ~1e12). The
  engine tags such a price `quoteUnit: "WETH"`, `isUsd: false`, and never prints
  a dollar sign for it. A USD figure for a WETH pool requires a separately
  VERIFIED WETH→USD conversion carrying its own provenance.
- The corporate-action multiplier is applied EXACTLY ONCE, on the reference
  (feed) side only — never twice, and never omitted when a raw underlying feed
  is the source. Pool-derived marks are never multiplied.

## Depth is not TVL, and depth is not authorization

- `depthToImpact{Buy,Sell}Usdg` is the conservative single-range USDG that must
  move through the pool to reach the policy impact ceiling. It is computed from
  real pool geometry and is denominated in USDG — it is meaningful only for
  USDG-quoted pools.
- Reported TVL is NOT usable depth: a pool can show large TVL with a dollar of
  liquidity at the current tick (out-of-range positions). Size against probed
  depth at multiple clip sizes, never against TVL.
- Depth is a measurement, NOT an authorization to trade. The dynamic
  buy/sell safe-notional is a separate, side-aware quantity, and it is UNKNOWN
  (never zero-by-default, never fabricated) whenever a required input —
  inventory, TWAP, a fresh reference — is UNKNOWN.

## Fail-closed states

`TEMPORARILY_HALTED`, `REFERENCE_STALE`, `POOL_EMPTY`, `CAPACITY_UNKNOWN`,
`POLICY_NOT_CALIBRATED`, and `CORPORATE_ACTION_PENDING` are honest intermediate
states. The tools report them plainly rather than over-claiming an executable
opportunity. A single verified pool can still authorize a bounded, single-venue
read/prepare posture; a lone venue is never grounds for a zero safe-notional by
itself — zero is set when the minimum trade fails policy.
