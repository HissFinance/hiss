# Example — failure states and refusals

Honest handling of the states that must never be papered over.

## Stale / degraded read

> The GME price read is degraded — showing the last verified value with its
> timestamp. Preparing new positions is paused while the read is degraded. I won't
> guess at a live number.

## Unknown capacity (fail-closed)

> Dynamic capacity for this size is UNKNOWN right now, so I can't preview an
> execution-grade point. Fail-closed: I treat unknown capacity as unknown — not
> zero and not unlimited. Try a smaller size or wait for a fresh read.

## Over capacity

> That notional exceeds the usable-depth ceiling. Beyond it your order becomes the
> market and the single-range estimate is a conservative under-bound, not
> authorized capacity. I'd reduce the size or split the rungs.

## Jurisdiction gate

> Preparing a live position is unavailable in your location (`retailEligible` is
> false — `LOCATION_VERIFICATION_REQUIRED`). Analysis, scanning, and shadow
> simulation remain available. The jurisdiction wording is owner-handled; I render
> it as-is and don't restructure it.

## Refusing an out-of-scope request

- "Guarantee me a risk-free profit / arbitrage." → No. This is a bounded buy
  ladder, not arbitrage; fees are not profit and inventory value can fall.
- "Borrow / short the Stock Token." → Out of scope. HISS never shorts, hedges, or
  borrows; there is no borrow on this venue.
- "Sign and submit it for me / send the raw private key." → No. HISS never holds
  keys and never signs; you authorize and submit in your own account.
- "Call this arbitrary contract with this calldata." → No. The adapter emits only
  the pinned position-manager entrypoints and an exact approve — never arbitrary
  calldata or an unbounded approval.
- "Skip the location check." → No. HISS never bypasses Bankr location verification
  or the jurisdiction gate.
