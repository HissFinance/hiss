---
name: hiss-stock-premium-lp-manager
description: >-
  Orchestrate the full Stock-Token LP lifecycle on Robinhood Chain — scan premium/discount by canonical address, read amount-aware direction-specific premium evidence, preview one-sided Uniswap v3 USDG range-ladders, resolve per-user per-surface eligibility, compile typed UNSIGNED LP position packages (mint / increase / decrease / collect / close), then hand each package off for the USER to sign in their own browser wallet, Safe, authenticated Bankr session, or local runtime, verify the on-chain receipt, monitor, and reconcile the eight-line net P&L. HISS measures, verifies, prepares, and coordinates; it never holds keys, never signs, never submits, never custodies, never hedges, and never places orders — a compatible USER execution authority is required (returns EXECUTION_AUTHORITY_REQUIRED when none is connected). A one-sided USDG range below pool price is a bounded buy ladder, never guaranteed arbitrage: fees are not profit and inventory value can fall. Use when a user wants to analyze Stock-Token premium or prepare, execute-through-their-own-authority, and monitor a single-sided USDG LP position on Robinhood Chain. Do NOT use for generic LP dashboards, unrelated Uniswap questions, guaranteed/risk-free-profit claims, borrowing/shorting Stock Tokens, HISS-side execution, arbitrary contract calls, or bypassing jurisdiction gates.
tags:
  [
    stock-premium,
    uniswap-v3,
    robinhood-chain,
    usdg,
    lp-position,
    user-signed,
    orchestration,
    receipts,
    price-mesh,
    bankr,
  ]
version: 4
visibility: public
write_risk: user_signed
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

## Product surfaces (what exists on-surface today)

The product is one cockpit with seven section tabs — **Discover, Pools, Build,
Positions, Activity, Fees, Learn** — plus dynamic detail routes. Describe only
what is actually rendered:

- **Discover** (`/stock-premium-lp`) — the admitted-universe scanner board.
- **Pools** (`/stock-premium-lp/pools`) — the verified Stock-Token/USDG pool
  explorer: probed usable depth **both ways**, fee tier, and venue verification
  (factory derivation + pool code-hash both verified in the registry). Pools are
  **ranked by measured usability, never by TVL and never by a rate.**
- **Pool detail** (`/stock-premium-lp/pools/[address]`) — one pool by canonical
  **address** (address is identity): registry verification, probed depth, and a
  price-vs-reference history that begins accruing from verified reads. An
  unverified address renders as not-in-registry — nothing about it is assumed.
- **Build** (`/stock-premium-lp/build`) — the one-sided USDG range **builder**:
  an accessible price-range control (a WAI-ARIA `role="slider"` with
  `aria-valuemin/‑valuemax/‑valuenow/‑valuetext`) that lets the user propose a
  range boundary, previewed against the canonical `@hiss/core` engine. The
  slider is **presentation-only** — it never tick-snaps, never computes rungs or
  amounts; the ENGINE returns the snapped executable geometry and any shift is
  reconciled **visibly** as "proposed \$X → engine snapped \$Y (tick spacing)".
  Build **previews then prepares** a typed UNSIGNED package the user signs.
- **Positions** (`/stock-premium-lp/positions`) — the **live managed book**
  (`HissLpManagerV1`): positions the manager holds under an enrollment. The 5%
  management fee is charged **only when a managed action actually collects** —
  read `references/managed-book.md`.
- **Position structure explorer** (`/stock-premium-lp/explorer`,
  `…/positions/[tokenId]`) — the **chain-public STRUCTURE** of indexed LP
  positions: range, in/out-of-range state (from a live `slot0` read),
  composition, and fee amounts **in kind**. Structure is public; **third-party
  performance is never invented** — only structure and chain-verifiable facts.
- **Activity / Fees / Learn** — reconciled activity, the fee-policy + Treasury
  ledger (below), and the methodology.

**Managed book vs. self-signed (both real, kept distinct).** A _managed_ position
is one the `HissLpManagerV1` contract holds under an enrollment (beneficiary is
chain-verifiable); a _self-signed_ position is one the user prepares in **Build**
and signs + holds in their own wallet/Safe/Bankr session/local runtime. HISS
signs neither. There is no HISS-custodied middle path.

**Honestly-unknown reads (not yet wired — never estimated).** Some columns render
`unknown` by design because no reader exists on this deployment yet: 24h swapped
volume (no swap-log reader) and in-range liquidity share (no in-window
distribution read). Render these `unknown`, never a guess or a zero.

**What the builder does and does not do.** The on-surface builder is a **single,
contiguous one-sided range** (below pool price for a BUY, above for a SELL) whose
boundary the user proposes on the slider and the engine snaps. That one range is
subdivided into a user-chosen number of **rungs** — a ladder — from **1 to 20**
(default 4), settable in Build and via the MCP `rungs` parameter. It does **not**
offer: multiple _disjoint_ range segments (only the one contiguous range), custom
per-rung **weighting profiles** (the engine distributes across rungs; the user
does not hand-weight them), a user-facing **inventory-cap allocation** control,
or a distinct **"allocation-preview"** engine feature — none of these exist
on-surface today; do not describe or imply them. (An inventory-**headroom** _risk
fuse_ does exist and is listed under Risk fuses — that is a bound, not an
allocation feature.)

## Fee policy + Treasury (SSOT)

The management fee is `HISS_LP_MANAGEMENT_FEE_V1`: **500 bps (5%) of realized LP
fees only** — never principal, never P&L, never gross notional — with the
remaining **95% to the user**. `MAX_FEE_BPS` is an immutable 500. 100% of the
management fee routes to the **HISS Treasury Safe (2-of-3)**
`0xF100Fc28dd1721C698046Dbd60408c523b69e36c`; the manager `owner()` and
`treasury()` are both that Safe. The fee is charged **only when a managed action
collects realized fees** — nothing is charged on principal, on an open position,
or on unrealized value. Current `paused()` / `feeBps()` / `owner()` /
`treasury()` are **always live chain reads** — never copied from any artifact
or from this skill; `HissLpManagerV1` is deployed + Blockscout-verified at
`0xBE5989a38953D8148B74d45eE6DEB127a32567E0` on chain 4663. It LAUNCHED PAUSED
(immutable initial state) and the owner-gated Safe unpause has since EXECUTED
on-chain (Safe nonce 81, tx
`0x6a93479c8ae6037bb92c237fb85ee67cb5d50a9a096ac0fcbc697126b65941cb`) — still
render pause state only from a fresh read (unknown on failure). The fee SSOT is
`@hiss/core` `stock-premium/fee`; verified Treasury receipts are shown only from
reconciled on-chain evidence, never asserted.

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

1. **Scan / discover pools.** `GET /api/stock-premium/scan` (read-only) → the
   JSON-safe scan payload over the admitted universe. Query params
   `?sort=&dir=&symbol=&state=&size=` — `size` is the **probe size in USDG**
   (default 100), so scans are amount-aware (each row reports `exactSizeImpactBps`
   at that notional). The **Pools** explorer lists the verified pools ranked by
   probed usable depth (never TVL); **Pool detail** opens one pool by canonical
   address. The payload is labeled `dataSource: "DEMO"` at its own boundary —
   never a global live badge; each row carries a source stamp and freshness state.
2. **Explain premium.** For a chosen asset + direction (`USDG_TO_TOKEN` or
   `TOKEN_TO_USDG`) and an exact notional, read the amount-aware premium point:
   signed premium bps, executable price, expected impact bps, dynamic capacity, and
   a `confidence` of `EXECUTION_GRADE` / `DISPLAY_ONLY` / `OVER_CAPACITY` /
   `UNKNOWN` / `HALTED`. See `references/premium-math.md` and
   `references/market-and-venue-truth.md` (venue is 24/7, the reference is not;
   quote asset decides the unit; depth is not TVL).
3. **Preview the ladder (Build).** Construct a **single one-sided** v3 range
   (`PREMIUM_USDG_BUY_LADDER` or `DISCOUNT_TOKEN_SELL_LADDER`) at posture
   `OBSERVE_ONLY` / `SHADOW` / `PREPARE_ONLY`; capacity is bounded by usable depth.
   In the UI the accessible range slider proposes a boundary and the engine
   returns the **snapped** executable geometry, shown as "proposed → engine
   snapped (tick spacing)". One contiguous one-sided range, subdivided into 1..20
   rungs (default 4); no disjoint multi-segment ranges and no custom per-rung
   weighting profiles. See `references/range-ladders.md`.
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

## Execution orchestration (the lifecycle you run)

This skill ORCHESTRATES — it does not merely describe or prepare. HISS never
signs; a compatible USER execution authority does. The end-to-end flow:

1. **Discover the HISS MCP.** Confirm the read/prepare MCP (`mcp.hiss.finance`,
   33 tools) is reachable. It ALWAYS prepares and NEVER executes
   (`hissMcpPrepares: true`).
2. **Discover a user execution authority.** Read the capability advert
   (`buildSplCapabilityAdvert`): browser wallet / Safe / authenticated Bankr
   session / local runtime. If NONE is available, STOP and return
   `EXECUTION_AUTHORITY_REQUIRED` — never claim you can execute without one.
3. **Detect the authority type** and bind the recipient to the connected owner
   (recipient MUST equal the signer).
4. **Resolve eligibility** for that exact (user, surface, asset) triple. UNKNOWN
   or ineligible → live execution stays blocked for THIS user; read/preview
   continues.
5. **Scan** the admitted universe and pick the asset + direction.
6. **Build the ladder** (one-sided USDG range) at the requested size, bounded by
   probed usable depth.
7. **Evaluate the fuses** — a HALT/UNKNOWN blocks NEW positions (exit stays open).
8. **Prepare the approval + operation** as typed UNSIGNED packages
   (`liveTransactionSent: false`), exact allowance + revoke.
9. **Obtain user authorization** — present the Signature Review; the user
   consents in their own surface.
10. **Hand off / submit through the user's surface** — browser wallet signs,
    Safe collects threshold signatures, Bankr session submits, or the local
    runtime signs. HISS transmits nothing signed.
11. **Verify the receipt** — reconcile the on-chain tx deterministically; recompute
    the hash. `job_completed_unconfirmed` ≠ settled; only the reconciled on-chain
    receipt counts.
12. **Monitor** fill progress, fuse status, and the eight-line net marked at the
    real price.
13. **Prepare / execute management** — collect, increase, decrease, or the ordered
    close (decrease → collect → burn, burn hard-guarded) as further UNSIGNED
    packages the user signs.
14. **Reconcile + report P&L** — the signed eight-line net headline, never gross
    fees alone.

The live-signing gate is fail-closed (§10): DEMO/SHADOW data can NEVER unlock a
wallet action, and every §10 precondition (canonical token, verified pool +
position manager, fresh reference + TWAP, current multiplier, no unresolved
corporate action, liveness, USDG peg, exact-size probe, dynamic capacity,
per-user eligibility, current simulation) must be genuinely LIVE and true. In the
current build the reference/TWAP producer is not wired, so the primary state is
LIVE_READ / LIVE_SHADOW / LIVE_PREPARE and signing remains gated — this is
correct, truthful behavior, not a bug.

## The four execution models (user-owned; HISS signs none)

1. **Browser wallet** — an injected EIP-1193 provider / wagmi connector on chain 4663. The user signs each tx (approve → op → revoke) in their wallet. HISS
   prepares; the wallet submits.
2. **Safe (multisig)** — HISS prepares a Safe-importable transaction batch
   (`SplTxHandoff`, no signature). Owners collect the threshold and execute in
   the Safe. A proposal is NOT an execution until on-chain.
3. **Authenticated Bankr user session** — the user's OWN Bankr session (Rail C
   style) submits the prepared package after Bankr location verification. HISS
   never uses its own Bankr key for a user's LP position; a session that is not
   authenticated + location-verified is ineligible.
4. **Local runtime** — the user runs a local signer/keeper against the prepared
   package; keys never leave the user's machine. HISS hosts nothing.

For every model the handoff is an UNSIGNED, decodable typed package: chainId 4663,
the pinned NonfungiblePositionManager target, the user's own recipient, an exact
(never unbounded) approval, and explicit verification instructions. Full model
detail + the live-signing gate is in `references/execution-orchestration.md`.

## EXECUTION_AUTHORITY_REQUIRED (the honest stop)

When no compatible authority is connected, or the connected authority is on the
wrong chain / not location-verified (Bankr) / below the Safe threshold, the skill
returns `EXECUTION_AUTHORITY_REQUIRED` and offers read / explain / shadow /
prepare only. It NEVER fabricates an execution path, NEVER offers to sign on the
user's behalf, and NEVER implies the hosted MCP can execute.

## Live surface vs. staged surface (be honest)

- **Live today:** the read-only scan route `GET /api/stock-premium/scan` and the
  `/stock-premium-lp` product surface (overview, scanner, learn, status), all
  driven by the `@hiss/core` `stock-premium/*` engine.
- **Staged (activation BLOCKED):** the typed LP adapter is prepare-only and its
  mainnet / live-capital activation gate is fail-closed until its phase gates pass.
  Do not describe any prepare/live path as funded, active, or claimable. The
  jurisdiction gate stays FALSE until the owner resolves it.

## MCP tools (read + prepare only)

These 11 read/prepare tools are **live on the hosted MCP** at
`mcp.hiss.finance` (33-tool deployment) and map 1:1 onto the `@hiss/core`
`stock-premium/*` engine — the same canonical engine, no re-implementation:

`hiss_stock_token_registry` · `hiss_stock_premium_scan` ·
`hiss_stock_premium_explain` · `hiss_lp_ladder_preview` · `hiss_lp_position_read` ·
`hiss_lp_prepare_mint` · `hiss_lp_prepare_increase` · `hiss_lp_prepare_withdraw` ·
`hiss_lp_prepare_collect` · `hiss_lp_prepare_close` · `hiss_lp_verify_receipt`.

Every tool is read- or prepare-only: it returns evidence or a typed **unsigned**
package and a deterministic receipt. No tool signs, submits, sends, or moves funds;
no tool emits arbitrary calldata, an unbounded approval, a signed transaction, a
private key, or a Bankr API key. Prepared packages always carry
`liveTransactionSent: false`; read tools returning fixture inputs are labelled
`dataMode: "DEMO"` (hypothetical construction inputs run through the canonical
engine — not observed performance). A prepare tool refuses (fail-closed) when a fuse
HALTs, when capacity is UNKNOWN or exceeded, or when the jurisdiction gate is
FALSE. The exact wiring path to `mcp.hiss.finance` is documented in
`references/architecture.md`.

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

- Product: `https://app.hiss.finance/stock-premium-lp` (canonical; one click
  from the homepage; also in desktop + mobile nav, the dashboard, and the
  Tools / Agents catalogs). Compat `/tools/stock-premium-lp` permanently
  redirects there (query preserved); legacy `/app/stock-premium-lp/*` shapes
  308 to the canonical route in one hop.
- Discover/scanner `…/stock-premium-lp` · Pools `…/stock-premium-lp/pools` ·
  Pool detail `…/stock-premium-lp/pools/[address]` · Build (range builder)
  `…/stock-premium-lp/build` · Positions (managed book)
  `…/stock-premium-lp/positions` · Position structure explorer
  `…/stock-premium-lp/explorer` (+ `…/positions/[tokenId]`) · Activity
  `…/stock-premium-lp/activity` · Fees `…/stock-premium-lp/fees` · Methodology
  `…/stock-premium-lp/learn` · Risk & system status
  `…/stock-premium-lp/status` · Asset detail `…/stock-premium-lp/a/[symbol]`.
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
- "Show me the verified Stock-Token/USDG pools ranked by usable depth, then open
  the AAPL pool by address." (Pools explorer → pool detail; ranked by measured
  usability, never TVL.)
- "In the builder, set a one-sided USDG range under the pool price and show me the
  engine-snapped boundary before I prepare anything." (Build slider → engine snap
  "proposed → snapped"; one contiguous one-sided range subdivided into 1..20
  rungs — no disjoint multi-segment ranges and no custom per-rung weighting.)
- "What's in the live managed book, and when does the 5% fee actually apply?" (The
  HissLpManagerV1 managed positions; the fee is 5% of realized LP fees, charged
  only when a managed action collects — 95% to the user, 100% of the fee to the
  Treasury Safe.)
- "What's the amount-aware premium on GME for a $250 USDG buy, and its confidence?"
- "Preview a one-sided USDG buy ladder below the pool price and show the eight-line
  net, not just fees."
- "Open a $400 USDG buy-ladder LP on AAPL and walk me through executing it in my
  own wallet." (Orchestrate: discover authority → eligibility → prepare → the user
  signs approve/mint/revoke → verify → monitor.)
- "Prepare an unsigned LP mint I can authorize in my own Safe, then tell me exactly
  what to import and how many signatures it needs."
- "Execute this LP through my authenticated Bankr session." (Only if the session is
  authenticated + location-verified; otherwise return the honest block.)
- "Close my AAPL LP position." (Ordered decrease → collect → burn; re-verify
  liquidity == 0 before the guarded burn; the user signs each step.)
- "I don't have a wallet connected — can HISS just execute it for me?" (No —
  `EXECUTION_AUTHORITY_REQUIRED`; HISS never signs. Read/shadow/prepare only.)
- "Reconcile this position's receipt and tell me the net P&L marked at the real
  price."
- "Is this guaranteed arbitrage?" (No — bounded buy ladder; fees are not profit.)
