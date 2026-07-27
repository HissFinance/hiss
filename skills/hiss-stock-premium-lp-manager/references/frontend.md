# Frontend

## Canonical surface

- Canonical route: `https://www.hiss.finance/stock-premium-lp` — reachable from the
  homepage in one click; top-level in desktop and mobile nav; featured in the
  dashboard and the Tools / Agents catalogs; wired into the command palette.
- Compat route: `/tools/stock-premium-lp` renders the SAME canonical surface. One
  product, not two.
- Cockpit tabs: **Discover** (`/stock-premium-lp`, scanner) · **Pools**
  (`/stock-premium-lp/pools`) · **Build** (`/stock-premium-lp/build`) ·
  **Positions** (`/stock-premium-lp/positions`, managed book) · **Activity**
  (`/stock-premium-lp/activity`) · **Fees** (`/stock-premium-lp/fees`) ·
  **Learn** (`/stock-premium-lp/learn`).
- Detail routes: `/stock-premium-lp/pools/[address]` (one pool),
  `/stock-premium-lp/explorer` + `…/positions/[tokenId]` (position structure),
  `/stock-premium-lp/a/[symbol]` (asset detail), `/stock-premium-lp/status` (risk
  & system status).

## What each screen must show

- **Discover / scanner** — the admitted assets matched by canonical address;
  real-price reference, pool price, signed premium/discount, usable depth (probed
  at the entered USDG **probe size**, not TVL), freshness, and the admission
  checks. Every number is a live read with a source stamp; a failed read is
  "unknown."
- **Pools explorer** — the verified Stock-Token/USDG pools ranked by **probed
  usable depth both ways** (never TVL, never a rate), fee tier, and venue
  verification (factory derivation + pool code-hash). 24h swapped volume and
  in-range liquidity share render **unknown** (no reader on this deployment yet)
  — never estimated. **Pool detail** opens one pool by canonical address with its
  price-vs-reference history from verified reads; an unverified address is shown
  as not-in-registry.
- **Build (range builder)** — asset → one-sided range (an accessible slider,
  `role="slider"` with full `aria-value*`) → size → fuses → simulate → review.
  The slider is presentation-only; the engine returns the **snapped** geometry,
  reconciled as "proposed → engine snapped (tick spacing)". Capacity note
  (bounded by usable depth), size-approaches-depth warning, simulated net
  headline (net first, always signed), shadow CTA. **One contiguous one-sided
  range** subdivided into 1..20 rungs (default 4) — no disjoint multi-segment
  ranges and no custom per-rung weighting profiles.
- **Positions (managed book)** — the live `HissLpManagerV1` managed positions;
  the 5% fee applies only when a managed action collects realized fees. **Position
  structure explorer** shows chain-public structure only (range, in/out-of-range
  from live `slot0`, composition, fees in kind) — third-party performance is
  never invented.
- **Signature Review** — "review and authorize in your own account"; typed unsigned
  package; target = the typed LP adapter on chain 4663; calldata hash; individually
  checked acknowledgments (fees are not profit / unhedged falling-knife /
  thin single-venue / premium may not converge). Handoff CTAs: authorize in wallet
  / prepare Safe transaction / send to Bankr session / export for local runtime.
  Never "Execute" or "Confirm to earn."
- **Position monitor** — live position, net P&L marked at the real price, fuse
  status, fill progress; paused / unreconciled / close-revoke states.
- **Receipt explorer** — replayable proof; "Matches" / "Does not match."
- **Risk & system status** — fuse states, price-mesh freshness, venue health, the
  activation gates, and the jurisdiction row (owner-handled wording preserved).

## Honest states

Degraded / stale / halted / unknown / empty / error states are all rendered
truthfully — never a fake green. Colors follow honesty, not optimism: a negative
net is never styled as positive; no badge implies live / funded / settled without
proof.
