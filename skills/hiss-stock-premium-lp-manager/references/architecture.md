# Architecture

## Where the logic lives

The entire Stock Premium LP Manager is driven by the `@hiss/core`
`stock-premium/*` engine — one truth layer, consumed by the web product, the
hosted MCP tools, and this skill. It never builds a second pricing engine: it
CONSUMES the canonical HISS Price Mesh.

| Module           | Responsibility                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.ts`    | Dynamic admission-gated Stock-Token registry — the fail-closed 12-check gate; `admitStockToken`, `buildStockTokenRegistry`. Address is identity.                                 |
| `premium.ts`     | Amount-aware, direction-specific premium/discount; `computePremiumPoint`, `computePremiumCurve`, `simulateBuy`, `simulateSell`. Multiplier applied exactly once, feed side only. |
| `ladder.ts`      | One-sided v3 range ladders; `buildLadder`, tick/price helpers. Templates + postures.                                                                                             |
| `pnl.ts`         | The honest eight-line P&L; `computePnlBreakdown`, `pnlViewShowsNetWithGross`.                                                                                                    |
| `risk/`          | The typed fuse family; context, bounds, engine, verdict (`PASS`/`WARN`/`DEGRADED`/`HALT`/`UNKNOWN`).                                                                             |
| `lp-adapter/`    | The typed prepare-only Uniswap v3 `NonfungiblePositionManager` adapter, intent, signature review, deterministic receipts, replay protection, canary.                             |
| `viewModels.ts`  | The STABLE typed FE/tool view models.                                                                                                                                            |
| `fingerprint.ts` | `evidenceFingerprint` — deterministic evidence hashing behind every record.                                                                                                      |

## Web surface (live today)

- Product routes under `apps/web/app/app/stock-premium-lp/**`: `page.tsx`
  (overview), `scan/`, `learn/`, `status/` — served at `app.hiss.finance/stock-premium-lp`.
  Compat `apps/web/app/app/tools/stock-premium-lp/` renders the same canonical surface.
- The one landed API route: `GET /api/stock-premium/scan`
  (`apps/web/app/api/stock-premium/scan/route.ts`) — read-only, `force-dynamic`,
  `cache-control: no-store`, `dataSource: "DEMO"`. It prepares nothing, signs
  nothing, moves no funds. Prepare/live routes are later phases.

## MCP integration path (live via dependency injection)

The read/prepare tool surface (`hiss_stock_token_registry`,
`hiss_stock_premium_scan`, `hiss_stock_premium_explain`, `hiss_lp_ladder_preview`,
`hiss_lp_position_read`, `hiss_lp_prepare_mint` / `_increase` / `_withdraw` /
`_collect` / `_close`, `hiss_lp_verify_receipt`) maps 1:1 to the engine functions
above and is **live on `mcp.hiss.finance` (33-tool deployment)**.

It ships through the public MCP without the public package importing the private
engine, via a `StockPremiumEngine` interface (dependency injection):

1. **Public `@hiss-finance/mcp-server`** declares the 11 tool definitions + a
   deterministic DEMO fixture engine, so the open-source package is self-contained
   and testable. On its own it answers with `dataMode: "DEMO"`.
2. **Hosted deployment (`apps/web/app/mcp`)** injects the REAL `@hiss/core`
   `stock-premium/*` engine into the same tool definitions — no engine
   re-implementation, no second pricing model. `mcp.hiss.finance` therefore serves
   the canonical engine behind the identical tool contract.

The private stdio `@hiss/mcp-server` exposes the base HISS toolset; the hosted
`mcp.hiss.finance` is the home for these 11 tools. Every tool stays read- or
prepare-only on both paths (`liveTransactionSent: false`, credential-shaped fields
rejected, fail-closed on HALT/UNKNOWN/jurisdiction).

## Boundary (custody + authority)

HISS-hosted responsibilities: scan, analyze, simulate, compile, preview,
prepare-typed-unsigned, verify receipts, monitor. HISS never holds private keys or
seed phrases, never stores Robinhood credentials, never signs as the user, never
submits arbitrary transactions, never custodies, never hedges, never shorts, and
never bypasses Bankr location verification. Execution happens only via the user's
own wallet / Safe / smart account / local runtime / authenticated Bankr session
under explicit bounded authorization.
