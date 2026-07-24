# Risk fuses

Typed, binding constraints evaluated before any Signature Review. Verdicts are
`PASS` / `WARN` / `DEGRADED` / `HALT` / `UNKNOWN`. Fuses compose strictest-wins and
never loosen at runtime. A passing audit is not a safety or profit guarantee.

## The fuse family (`stock-premium/risk/fuses.ts`)

| Fuse | Guards |
|---|---|
| canonical-token | Asset matches its canonical on-chain address (identity, not ticker). |
| canonical-pool | Pool factory derived on-chain; `factory()` / periphery check out; impostor periphery rejected. |
| code-hash | Token/pool code-hash matches the pinned canonical values. |
| multiplier-transition | No pending multiplier transition in flight. |
| corporate-action | No corporate action in progress; oracle not paused. |
| stale-reference | Reference feed is fresh; a stale read degrades/halts, never fills. |
| twap | Pool price vs venue TWAP divergence within bound. |
| exact-size-impact | The exact size's price impact within bound. |
| usdg-peg | USDG peg within policy. |
| accepted-fill-price | The accepted fill price within the authorized band. |
| pool-depth | Usable depth (simulated) sufficient for the size. |
| liquidity-removal | Exit path — always evaluable so a position can be withdrawn. |
| liveness | Chain/reads live. |
| reconciliation | Prepared/executed actions reconcile to receipts. |
| inventory | Inventory bounds (unhedged falling-knife exposure). |
| symbol-capital / total-capital | Per-symbol and total capital ceilings. |
| turnover | Position turnover bound. |
| range-width | Range width within policy. |
| gas | Gas assumption within bound. |
| authorization-expiry | Bounded authorization not expired. |
| jurisdiction | `retailEligible=true` — fail-closed FALSE for live until owner-resolved. |

## Exit is always reachable

A `HALT` blocks NEW positions. Observing and exiting (liquidity removal) are always
reachable — a pause never traps funds. This mirrors the exits-are-not-pausable
principle elsewhere in HISS.

## Fail-closed

Every fuse defaults to its safe verdict on absent or low-confidence evidence:
UNKNOWN is not PASS. A prepare tool refuses when any fuse HALTs, when capacity is
UNKNOWN or exceeded, or when the jurisdiction gate is FALSE.
