# Architecture

## Where the logic lives

The entire Stock Premium LP Manager is driven by the `@hiss/core`
`stock-premium/*` engine — one truth layer, consumed by the web product, the
(intended) MCP tools, and this skill. It never builds a second pricing engine: it
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

- Product routes under `apps/web/app/(product)/stock-premium-lp/**`: `page.tsx`
  (overview), `scan/`, `learn/`, `status/`. Compat `apps/web/app/tools/stock-premium-lp/`
  renders the same canonical surface.
- The one landed API route: `GET /api/stock-premium/scan`
  (`apps/web/app/api/stock-premium/scan/route.ts`) — read-only, `force-dynamic`,
  `cache-control: no-store`, `dataSource: "DEMO"`. It prepares nothing, signs
  nothing, moves no funds. Prepare/live routes are later phases.

## MCP integration path (assessment — scoped follow-on)

The read/prepare tool surface (`hiss_stock_token_registry`,
`hiss_stock_premium_scan`, `hiss_stock_premium_explain`, `hiss_lp_ladder_preview`,
`hiss_lp_position_read`, `hiss_lp_prepare_mint` / `_increase` / `_withdraw` /
`_collect` / `_close`, `hiss_lp_verify_receipt`) maps 1:1 to the engine functions
above.

Two distinct MCP servers exist and must not be conflated:

1. **Private `mcp-server` (`@hiss/mcp-server`)** — the local stdio HISS MCP that
   already depends on `@hiss/core`. It can register these read/prepare tool
   definitions cleanly (thin adapters over the engine), because the engine is
   already in its dependency graph. This is the low-friction home for the tools.
2. **Public `mcp.hiss.finance` (`@hiss-finance/mcp-server`)** — a SEPARATE public
   package. It does NOT currently import the `stock-premium` engine, so exposing
   these tools there requires either mirroring the engine functions into the public
   package or wiring the public server to a read/prepare HTTP surface. That is a
   deliberate follow-on and is NOT implied to be live.

Until wired, describe the tools as the intended read/prepare surface, never as live
on `mcp.hiss.finance`. Every tool stays read- or prepare-only on both servers.

## Boundary (custody + authority)

HISS-hosted responsibilities: scan, analyze, simulate, compile, preview,
prepare-typed-unsigned, verify receipts, monitor. HISS never holds private keys or
seed phrases, never stores Robinhood credentials, never signs as the user, never
submits arbitrary transactions, never custodies, never hedges, never shorts, and
never bypasses Bankr location verification. Execution happens only via the user's
own wallet / Safe / smart account / local runtime / authenticated Bankr session
under explicit bounded authorization.
