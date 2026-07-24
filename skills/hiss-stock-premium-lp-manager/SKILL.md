---
name: hiss-stock-premium-lp-manager
description: Scan Robinhood Chain Stock-Token premium/discount by canonical address, read amount-aware direction-specific premium evidence, preview one-sided Uniswap v3 USDG range-ladders, and compile typed UNSIGNED LP position packages (mint / increase / decrease / collect / close) the user signs in their own wallet, Safe, smart account, or authenticated Bankr session — plus position monitoring, fee collection, withdrawal, and deterministic receipt verification. HISS measures, verifies, and prepares; it never holds keys, never signs, never custodies, never hedges, and never places orders. A one-sided USDG range below pool price is a bounded buy ladder, never guaranteed arbitrage: fees are not profit and inventory value can fall. Use when a user wants to analyze Stock-Token premium or prepare/monitor a single-sided USDG LP position on Robinhood Chain. Do NOT use for generic LP dashboards, unrelated Uniswap questions, guaranteed/risk-free-profit claims, borrowing/shorting Stock Tokens, unrestricted wallet execution, arbitrary contract calls, or bypassing jurisdiction gates.
tags: [stock-premium, uniswap-v3, robinhood-chain, usdg, lp-position, prepare-only, receipts, price-mesh, bankr]
version: 1
visibility: public
write_risk: prepare_only
runtime_requirement: none
local_only_data: false
required_hiss_skills: [hiss-price-mesh, hiss-receipts, hiss-risk-fuses, hiss-security-boundaries]
required_mcp_servers: [hiss-mcp]
required_capability_families: []
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Stock Premium LP Manager

## Purpose

Measure the premium or discount of a Robinhood Chain **Stock Token** against a
real-price reference, simulate a **single-sided USDG range ladder** with its full
honest cost model, and compile a **typed, unsigned Uniswap v3 LP position package**
the user authorizes and submits themselves. HISS scans, analyzes, simulates,
compiles, previews, prepares typed-unsigned packages, verifies receipts, and
monitors — nothing else. The user's own wallet / Safe / smart account / local
runtime / authenticated Bankr session executes.

This is a **bounded, uncertain strategy surface — never arbitrage**. A one-sided
USDG range below the pool price is a bounded buy ladder: USDG converts to the
Stock Token as the price falls; the position may accrue fees; its inventory value
may fall at the same time. **Fees are not profit.**

Canonical engine: `@hiss/core` `stock-premium/*`. Canonical surface:
`/stock-premium-lp` (compat `/tools/stock-premium-lp` renders the same product).

## The core product truth (non-negotiable)

The product ALWAYS computes and displays these eight lines **separately**, with the
net line as the signed headline:

1. Realized LP fees
2. Realized inventory P&L
3. Unrealized inventory P&L (marked at the **real-price** reference, not pool-only)
4. Gas
5. Swap costs
6. Position-management costs
7. Adverse-selection estimate (labeled estimate)
8. **Net strategy P&L** ← headline; visibly signed; a negative net renders negative.

A positive fee figure beside a negative net is **not a win**. Anywhere a fee figure
appears, the real-price-marked net appears beside it (`pnlViewShowsNetWithGross`).
The teaching illustration "fees positive, net negative" is a hypothetical only —
never attributed to HISS, the external skill, or any observed result.

## Hard rules

1. **Prepare, never execute.** HISS compiles typed unsigned LP-position packages
   through a SEPARATE typed `NonfungiblePositionManager` adapter (never the Bankr
   B2 swap adapter). HISS never holds keys or seed phrases, never signs, never
   submits, never custodies, never hedges, never shorts, never places brokerage
   orders, and never bypasses Bankr location verification. HISS servers never place
   or cancel an order. The user authorizes and submits in their own account.
2. **Address is identity.** Assets match by canonical on-chain **address**, not
   ticker. A matching ticker at a different address is not official and is rejected.
   Admission is a fail-closed 12-check gate (see `references/supported-assets.md`).
3. **Multiplier applied exactly once, feed side only.** The Stock-Token
   price multiplier is applied a single time to the reference feed via the mesh's
   own `adjustedFeedE18`; pool marks are NEVER routed through it. Applying it twice,
   or to a pool mark, is a defect.
4. **Fees ≠ net P&L.** Always render the eight lines with the signed net headline.
   Never present gross fees as the result.
5. **Premium is uncertain and may not converge.** Premium can stay wide
   indefinitely when mint/redeem is gated and no borrow exists. Position for
   oscillation within a measured band — never "will converge."
6. **Thin, single-venue liquidity.** The only proven venue is Uniswap v3 on chain
   4663; pools are thin; TVL is not depth. Capacity is bounded by usable depth
   probed with simulated swaps; at or beyond the cap, the order becomes the market.
7. **Status needs proof.** Deployed / live / funded / settled require affirmative
   evidence. A failed read is "unknown" — never "live" and never "not deployed."
   An unreconciled position is UNRECONCILED, never settled.
8. **Jurisdiction-gated, fail-closed.** Stock Tokens are tokenized derivatives.
   Analysis (scan / observe / shadow / prepare) admits on checks 1–11; LIVE
   execution additionally requires check 12 (`retailEligible=true`), which is
   fail-closed FALSE until the owner resolves it — surfacing
   `LOCATION_VERIFICATION_REQUIRED` / `JURISDICTION_UNAVAILABLE`. GME admits for
   analysis while live stays blocked. Jurisdiction wording is owner-handled and
   preserved byte-for-byte; agents never author or restructure it.

## Postures (strictly separated)

- **Observe-only** — scan the admitted universe, read premium/discount, usable
  depth, freshness, and the honest cost model. No wallet, no capital, no tx.
- **Shadow** — construct a ladder and simulate its accounting against live reads;
  watch a shadow position with no capital and no transaction. Shadow P&L is NEVER
  merged into a live total; the two are distinct.
- **Prepare-only** — compile a typed unsigned position package, review it in
  Signature Review, hand it to the user's wallet / Safe / smart account / Bankr
  session. HISS reconciles the on-chain receipt afterward.

## Workflow (agent)

1. **Scan.** `GET /api/stock-premium/scan` (read-only) → the JSON-safe scan payload
   over the admitted universe. Query params `?sort=&dir=&symbol=&state=&size=`. The
   payload is labeled `dataSource: "DEMO"` at its own boundary — never a global live
   badge; each row carries a source stamp and freshness state.
2. **Explain premium.** For a chosen asset + direction (`USDG_TO_TOKEN` or
   `TOKEN_TO_USDG`) and an exact notional, read the amount-aware premium point:
   signed premium bps, executable price, expected impact bps, dynamic capacity, and
   a `confidence` of `EXECUTION_GRADE` / `DISPLAY_ONLY` / `OVER_CAPACITY` /
   `UNKNOWN` / `HALTED`. See `references/premium-math.md`.
3. **Preview the ladder.** Build a one-sided v3 range ladder
   (`PREMIUM_USDG_BUY_LADDER` or `DISCOUNT_TOKEN_SELL_LADDER`) at posture
   `OBSERVE_ONLY` / `SHADOW` / `PREPARE_ONLY`; capacity is bounded by usable depth.
   See `references/range-ladders.md`.
4. **Simulate the accounting.** Compute the eight-line breakdown; show the signed
   net headline first.
5. **Prepare (typed, unsigned).** For a prepare-only ladder, compile the typed LP
   intent (mint / increase / decrease / collect / burn) — gated by the fuse verdict
   — plus the exact Signature Review payload and the calldata hash.
6. **Review + hand off.** The user reviews the unsigned package and its
   acknowledgments, then authorizes and submits in their own wallet / Safe / smart
   account / Bankr session. HISS signs nothing.
7. **Reconcile + monitor.** After the user submits, reconcile the on-chain receipt
   deterministically; recompute the hash. Monitor fill progress, fuse status, and
   net P&L marked at the real price. Prepare collect / withdraw / close as further
   unsigned packages. Never auto-retry — reconcile first, retry only after.

## Live surface vs. staged surface (be honest)

- **Live today:** the read-only scan route `GET /api/stock-premium/scan` and the
  `/stock-premium-lp` product surface (overview, scanner, learn, status), all
  driven by the `@hiss/core` `stock-premium/*` engine.
- **Staged (activation BLOCKED):** the typed LP adapter is prepare-only and its
  mainnet / live-capital activation gate is fail-closed until its phase gates pass.
  Do not describe any prepare/live path as funded, active, or claimable. The
  jurisdiction gate stays FALSE until the owner resolves it.

## MCP tools (read + prepare only)

The intended read/prepare tool surface maps 1:1 onto the `@hiss/core`
`stock-premium/*` engine:

`hiss_stock_token_registry` · `hiss_stock_premium_scan` ·
`hiss_stock_premium_explain` · `hiss_lp_ladder_preview` · `hiss_lp_position_read` ·
`hiss_lp_prepare_mint` · `hiss_lp_prepare_increase` · `hiss_lp_prepare_withdraw` ·
`hiss_lp_prepare_collect` · `hiss_lp_prepare_close` · `hiss_lp_verify_receipt`.

Every tool is read- or prepare-only: it returns evidence or a typed **unsigned**
package and a deterministic receipt. No tool signs, submits, sends, or moves funds;
no tool emits arbitrary calldata, an unbounded approval, a signed transaction, a
private key, or a Bankr API key. A prepare tool refuses (fail-closed) when a fuse
HALTs, when capacity is UNKNOWN or exceeded, or when the jurisdiction gate is
FALSE. Availability + the exact wiring path to `mcp.hiss.finance` are documented in
`references/architecture.md` (the public `mcp.hiss.finance` currently serves a
different package; exposing these there is a scoped follow-on, not implied live).

## Risk fuses (typed, binding)

The position is bounded by typed fuses evaluated before any Signature Review, with
verdicts `PASS` / `WARN` / `DEGRADED` / `HALT` / `UNKNOWN`: canonical-token,
canonical-pool, code-hash, multiplier-transition, corporate-action,
stale-reference, TWAP-divergence, exact-size-impact, USDG-peg, accepted-fill-price,
pool-depth, liquidity-removal, liveness, reconciliation, inventory, symbol-capital,
total-capital, turnover, range-width, gas, authorization-expiry, and jurisdiction.
Fuses compose strictest-wins and never loosen at runtime. A HALT blocks NEW
positions; **observing and exiting (liquidity removal) are always reachable** — a
pause never traps funds. A passing fuse audit is not a safety or profit guarantee.
See `references/risk-fuses.md`.

## Receipts (deterministic, replayable)

Every prepared and executed action carries a deterministic receipt across the
lifecycle — compile, preparation, authorization, submission, settlement,
reconciliation. Recompute the hash; a receipt that does not verify does not count.
A compile/preparation receipt is prepare-only evidence and never proves execution;
settlement is proven only by the reconciled on-chain receipt. See
`references/receipts.md`.

## Frontend deep links

- Product: `https://www.hiss.finance/stock-premium-lp` (one click from the
  homepage; also in desktop + mobile nav, the dashboard, and the Tools / Agents
  catalogs). Compat `/tools/stock-premium-lp` renders the same surface.
- Scanner `…/stock-premium-lp/scan` · Methodology `…/stock-premium-lp/learn` ·
  Risk & system status `…/stock-premium-lp/status`.
- Docs: Stock Tokens `/docs/tokenized-assets` · Bankr lane
  `/docs/bankrbot-robinhood` · MCP server `/docs/mcp-server` · Agent tools
  `/docs/agent-tools`.

## Banned vocabulary (never use as a claim)

Never: guaranteed, risk-free, passive income, APY, APR, yield rate, best execution,
free money, arbitrage or guaranteed arbitrage, impermanent-loss protection,
dividends or holder-reward framing, "safe"/"always-available"/"dependable"
liquidity, "will converge", or any claim that HISS shorts, hedges, custodies,
signs, or places orders. Never attribute the "fees positive / net negative"
illustration to HISS, an external source, or observed performance. These are banned
everywhere and enforced by the copy guards.

## Related skills

- `hiss-price-mesh` — reference quote vs executable liquidity (the same separation
  this skill enforces between a real-price reference and a size-specific fill).
- `hiss-bankr-stock-tokens` — the canonical Stock-Token address registry and the
  Bankr stock-token lane (a separate rail; trades ≠ LP positions).
- `hiss-risk-fuses` · `hiss-receipts` · `hiss-security-boundaries` — the fuse,
  receipt, and custody/consent models this skill composes.

## Example prompts

- "Scan Robinhood Chain Stock-Token premium and show usable depth per asset."
- "What's the amount-aware premium on GME for a $250 USDG buy, and its confidence?"
- "Preview a one-sided USDG buy ladder below the pool price and show the eight-line
  net, not just fees."
- "Prepare an unsigned LP mint I can authorize in my own Safe."
- "Reconcile this position's receipt and tell me the net P&L marked at the real
  price."
- "Is this guaranteed arbitrage?" (No — bounded buy ladder; fees are not profit.)
