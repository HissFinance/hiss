# Frontend

## Canonical surface

- Canonical route: `https://www.hiss.finance/stock-premium-lp` — reachable from the
  homepage in one click; top-level in desktop and mobile nav; featured in the
  dashboard and the Tools / Agents catalogs; wired into the command palette.
- Compat route: `/tools/stock-premium-lp` renders the SAME canonical surface. One
  product, not two.
- Sub-routes: `/stock-premium-lp/scan` (scanner), `/stock-premium-lp/learn`
  (methodology / education), `/stock-premium-lp/status` (risk & system status).

## What each screen must show

- **Scanner** — the admitted assets matched by canonical address; real-price
  reference, pool price, signed premium/discount, usable depth (probed, not TVL),
  freshness, and the admission checks. Every number is a live read with a source
  stamp; a failed read is "unknown."
- **Opportunity workspace** — venue verification, premium-uncertainty panel, depth
  panel (TVL ≠ depth), and the eight-line cost model with the signed net headline.
- **Guided position builder** — asset → range & ladder → size → fuses → simulate →
  review; capacity note (bounded by usable depth), size-approaches-depth warning,
  simulated net headline (net first, always signed), shadow CTA.
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
