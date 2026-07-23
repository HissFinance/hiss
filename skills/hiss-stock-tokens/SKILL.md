---
name: hiss-stock-tokens
description: Prepare, validate, and reconcile Bankr trades of Robinhood Chain tokenized stocks and ETFs (15 canonical assets, USDG settlement) — build a capped order plan and the exact Bankr command ("… on robinhood", always), optionally submit through the gated Bankr Agent API, and confirm settlement only from an onchain tx receipt. Assets are tokenized stock/ETF exposure, not direct stock ownership; Bankr executes, Bankr's console handles location verification externally, HISS validates addresses and caps and reconciles receipts. Use when a user wants to trade Robinhood Chain stock tokens through Bankr.
tags: [bankr, stock-tokens, robinhood-chain, usdg, tokenized-etf, receipts, price-mesh]
version: 3
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Bankr Stock-Token Lane (Rail B)

## Purpose

This is Rail B of the HISS three-rail Bankr model
(`rail_b_bankr_stock_token`): Bankr executes tokenized stock/ETF trades on
the Robinhood Chain venue, settling in USDG (Bankr routes through USDG
automatically). HISS compiles a validated, capped order plan and the exact
command text, and reconciles receipts against chain state.
`hissExecutesTrade` is hard-typed `false` everywhere.

15 tradable assets (canonical addresses derived from
docs.robinhood.com/chain/contracts, address-is-identity): AAPL, AMD, AMZN,
COIN, GOOGL, META, MSFT, NVDA, PLTR, TSLA, SPY, QQQ, SGOV, SLV, CUSO.

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
   `BANKR_EXTERNAL_VERIFICATION_REQUIRED` and point the user to the Bankr
   console.
5. **Caps reject, never clamp.** Notional cap default $500
   (`BANKR_STOCK_TRADE_MAX_NOTIONAL_USD` env override), slippage default
   100 bps with a 500 bps hard cap.
6. **A completed Bankr job is not settlement.** `completed` maps to
   `job_completed_unconfirmed`. Only an onchain tx receipt with status
   `0x1` on chain 4663 yields `onchain_confirmed`. No fill claims, ever.

## Workflow (agent)

1. `POST /api/stocks/prepare-bankr-command` with the user's intent →
   `{plan, commandPack, executed: false}`. Show the plan (caps, canonical
   addresses, USDG settlement) and the command.
2. The user runs the command themselves (`@bankrbot …` on X, or
   `bankr --ni "…"`) — or, when the lane is enabled, confirm the exact
   `planHash` and `POST /api/stocks/submit-bankr-intent`.
3. Poll `GET /api/stocks/bankr-job/[jobId]` for job status (gated).
4. Reconcile: `POST /api/stocks/reconcile-receipt` with `txHash` (preferred)
   or `jobId` → a `BankrStockTokenReceipt`. Only `onchain_confirmed` counts
   as settled.

## API routes (base https://app.hiss.finance)

| Route                                    | In → Out                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/stocks/registry`               | 15 canonical assets + USDG settlement + identity rule                                         |
| `GET /api/stocks/bankr-status`           | Lane status (env booleans only, never key values)                                             |
| `POST /api/stocks/prepare-bankr-command` | `{intent, nowIso?}` → `{plan, commandPack, executed: false}`                                  |
| `POST /api/stocks/submit-bankr-intent`   | GATED: `{intent, userConfirmedPlanHash, nowIso?}` → `{jobId, receiptStatus, poll, reconcile}` |
| `GET /api/stocks/bankr-job/[jobId]`      | GATED: job status (`completed` ≠ settlement)                                                  |
| `POST /api/stocks/reconcile-receipt`     | `{txHash? \| jobId?, planHash?}` → onchain-verified receipt                                   |

Gates on submit/poll: `BANKR_AGENT_API_ENABLED=true` AND a server-only Bankr
Agent API key (referenced by env NAME only, never by value) — otherwise an
honest 503 `LANE_NOT_ENABLED`, never fake acceptance. `vault_operator_rebalance` intents are refused here
(`VAULT_REBALANCE_NOT_ALLOWED_HERE`). 256 KB cap · 30 req / 5 min ·
credential fields rejected.

## HTTP tool routes

`POST /api/stocks/prepare-bankr-command` (prepare a trade and generate the exact
Bankr command) · `POST /api/stocks/submit-bankr-intent` (gated; refuses without
the env gates) · `POST /api/stocks/reconcile-receipt` (reconcile a job to an
on-chain receipt) — same semantics and the same output guards.

## Price-mesh integration (reference vs executable)

Any price shown for a stock token on this chain venue is a **reference quote**,
not a fill. Use `hiss-price-mesh` to keep the two apart:

- A chain-side stock-token reference price and a Robinhood brokerage quote for
  the same underlying are two different prices on two different rails — never
  presented as a parity or a conversion. Tokenized exposure ≠ direct share
  ownership, and the prices are not identical.
- What a Bankr command actually fills at is executable liquidity on the chain
  venue at the moment of settlement, size-specific — never the reference number
  and never known before the onchain receipt. The plan's caps reject; they do
  not promise a fill price.
- Every quoted reference carries its source and age; a stale reference is not a
  settlement price. Settlement is proven only by `onchain_confirmed`.

## Related skills

- `hiss-price-mesh` (reference vs executable liquidity) · `hiss-vault-agent-kit`
  (USDG vaults) · `hiss-bankrbot-vault-deposit` · `hiss-receipts` ·
  `hiss-cross-rail-handoff` (moving USDG between rails is a manual handoff).

## Example prompts

- "Prepare a $100 USDG buy of NVDA stock token via Bankr."
- "Give me the exact @bankrbot command to sell half my AAPL token."
- "Reconcile this tx hash and tell me if the trade actually settled."
- "Is the chain NVDA-token price the same as the Robinhood NVDA quote?" (no)
