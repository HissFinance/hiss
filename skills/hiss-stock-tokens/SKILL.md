---
name: hiss-stock-tokens
description: Prepare, validate, and reconcile Bankr trades of Robinhood Chain tokenized stocks and ETFs (15 canonical assets, USDG settlement) — build a capped order plan and the exact Bankr command ("… on robinhood", always), optionally submit through the gated Bankr Agent API, and confirm settlement only from an onchain tx receipt. Assets are tokenized stock/ETF exposure, not direct stock ownership; Bankr executes, Bankr's console handles location verification externally, HISS validates addresses and caps and reconciles receipts. Use when a user wants to trade Robinhood Chain stock tokens through Bankr.
tags: [bankr, stock-tokens, robinhood-chain, usdg, tokenized-etf, receipts]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_supported_assets
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Bankr Stock-Token Lane (Rail B)

## Purpose

This is Rail B of the HISS three-rail Bankr model
(`rail_b_bankr_stock_token`): Bankr executes tokenized stock/ETF trades on
the Robinhood Chain venue, settling in USDG (Bankr routes through USDG
automatically). HISS compiles a validated, capped order plan and the exact
command text, and reconciles receipts against chain state.
`hissExecutesTrade` is hard-typed `false` everywhere.

**Tokenized stocks are economic exposure, not direct share ownership**, and
may be region- or provider-restricted. HISS is not affiliated with Robinhood
or Bankr.

15 tradable assets (canonical addresses from the Robinhood Chain contract
docs, address-is-identity): AAPL, AMD, AMZN, COIN, GOOGL, META, MSFT, NVDA,
PLTR, TSLA, SPY, QQQ, SGOV, SLV, CUSO.

## Hard rules

1. **Commands always end "on robinhood".** The venue is never implied —
   command validation fails closed with `MISSING_ON_ROBINHOOD` otherwise.
   Templates: `buy $<amount> of <SYMBOL> on robinhood` ·
   `swap $<amount> of USDG to <SYMBOL> on robinhood` ·
   `sell <half|all|amount> [my] <SYMBOL> on robinhood`.
2. **Canonical addresses only.** Address is identity; a ticker match is
   never sufficient (`NON_CANONICAL_ADDRESS` rejection). The registry fails
   closed at load on any address drift.
3. **Tokenized exposure, not ownership.** Never claim direct stock
   ownership; the intent requires
   `userAcknowledgedTokenizedExposureNotDirectStockOwnership: true` and
   `userAcknowledgedBankrExecutesTrade: true`.
4. **Location verification is Bankr's, in the Bankr console, externally.**
   HISS never collects or verifies location (`hissCollectsLocation: false`,
   hard-typed). If Bankr rejects for verification, surface
   `BANKR_EXTERNAL_VERIFICATION_REQUIRED` and point the user to Bankr.
5. **Caps reject, never clamp.** Notional cap default $500 (env-configurable
   by NAME), slippage default 100 bps with a 500 bps hard cap.
6. **A completed Bankr job is not settlement.** `completed` maps to
   `job_completed_unconfirmed`. Only an onchain tx receipt with status
   `0x1` on chain 4663 yields `onchain_confirmed`. No fill claims, ever.

## Workflow (agent)

1. `POST /api/stocks/prepare-bankr-command` with the user's intent →
   `{plan, commandPack, executed: false}`. Show the plan (caps, canonical
   addresses, USDG settlement) and the command.
2. The user runs the command themselves (`@bankrbot …` on X, or the Bankr
   CLI) — or, when the lane is enabled, confirm the exact `planHash` and
   `POST /api/stocks/submit-bankr-intent`.
3. Poll `GET /api/stocks/bankr-job/[jobId]` for job status (gated).
4. Reconcile: `POST /api/stocks/reconcile-receipt` with `txHash` (preferred)
   or `jobId` → a `BankrStockTokenReceipt`. Only `onchain_confirmed` counts
   as settled.

## API routes (base `https://app.hiss.finance`; `www.hiss.finance` still serves these routes for compatibility)

| Route                                    | In → Out                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/stocks/registry`               | 15 canonical assets + USDG settlement + identity rule                                         |
| `GET /api/stocks/bankr-status`           | Lane status (env booleans only, never key values)                                             |
| `POST /api/stocks/prepare-bankr-command` | `{intent, nowIso?}` → `{plan, commandPack, executed: false}`                                  |
| `POST /api/stocks/submit-bankr-intent`   | GATED: `{intent, userConfirmedPlanHash, nowIso?}` → `{jobId, receiptStatus, poll, reconcile}` |
| `GET /api/stocks/bankr-job/[jobId]`      | GATED: job status (`completed` ≠ settlement)                                                  |
| `POST /api/stocks/reconcile-receipt`     | `{txHash? \| jobId?, planHash?}` → onchain-verified receipt                                   |

Gates on submit/poll: the lane-enabled boolean flag AND a server-only Bankr
API key (referenced by env NAME only, never by value) — otherwise an honest
503 `LANE_NOT_ENABLED`, never fake acceptance. `vault_operator_rebalance`
intents are refused here (`VAULT_REBALANCE_NOT_ALLOWED_HERE`). 256 KB cap ·
30 req / 5 min · credential fields rejected.

## Interfaces

The Bankr stock-token lane (Rail B) is exposed through the **HTTP API only** (the
`POST /api/stocks/*` routes above) — it has **no dedicated MCP tools**. The MCP
server's `hiss_get_supported_assets` (see `hiss-mcp`) lists the canonical
tradable assets; everything else on this lane goes through the HTTP routes, and
every output carries the same execution-claim and settlement guards.

## Example prompts

- "Prepare a $100 USDG buy of NVDA stock token via Bankr."
- "Give me the exact @bankrbot command to sell half my AAPL token."
- "Reconcile this tx hash and tell me if the trade actually settled."
