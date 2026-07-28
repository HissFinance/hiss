---
name: hiss-lighter
description: How HISS integrates with Lighter (the Robinhood-instance perp/spot exchange at api.rh.lighter.xyz). HISS reads PUBLIC market data (markets, orderbook, mid/spread/depth, trades) and PREPARES typed UNSIGNED order intents; it never signs, submits, or holds a Lighter API private key or auth token. Robinhood Stock-Token markets exist as USDG-quoted spot books (AAPL/USDG, TSLA/USDG, …). Signing happens only in the user's own local runtime via the official Python/Go SDK. Use when a user or agent asks whether HISS trades on Lighter, how to place a Lighter order, Lighter stock tokens, precision, nonces, or API keys.
tags: [lighter, robinhood, stock-tokens, usdg, market-data, prepare-only, local-signer, rail-boundaries]
version: 2
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS × Lighter (Robinhood instance)

## What Lighter is (verified 2026-07-28)

Lighter is an order-book exchange. HISS integrates the **Robinhood instance** at
`https://api.rh.lighter.xyz` (WebSocket `wss://api.rh.lighter.xyz/stream`). At
capture time it lists **65 active markets**: 39 perpetuals + **26 spot** markets.

**Robinhood Stock-Token markets EXIST** — they are the **spot** markets quoted
in **USDG** (`quote_asset_id 3`, symbol `TICKER/USDG`): AAPL/USDG, AMZN/USDG,
GOOGL/USDG, META/USDG, MSFT/USDG, NVDA/USDG, TSLA/USDG, QQQ/USDG, SPY/USDG,
COIN/USDG, PLTR/USDG, and more. These are central-limit-order-book spot markets,
**not** an on-chain Lighter contract and **not** perpetuals. USDG is HISS's own
vault asset, which is why these venues matter to HISS.

## The boundary (non-negotiable)

HISS is READ + PREPARE only. The current rail rung is **PREPARE**.

- **READ** — HISS fetches public market data: market list + stock-token
  classification, normalized orderbook (bestBid/bestAsk/mid/spread/depth), recent
  trades. Fail-closed: a failed read is `DEGRADED`; an unknown market is
  `MARKET_NOT_AVAILABLE`; an empty book yields `null` (UNKNOWN) — never a
  fabricated price.
- **PREPARE** — HISS builds a **typed, UNSIGNED** order/cancel/modify intent:
  the exact integer-scaled fields Lighter needs plus a HISS risk envelope and a
  deterministic `intentHash`. `signed` is always `false`.
- **HISS never** signs, submits, or holds a Lighter API **private key**, **auth
  token**, or **user nonce**. There is no hosted execution path.

Why this is also a technical fact: there is **no TypeScript/JavaScript Lighter
SDK**. Signing uses `SignerClient`, a wrapper over a compiled `lighter-go`
binary. HISS (TypeScript) physically cannot sign — so signing lives in the
user's local runtime.

## Where signing actually happens (local signer)

The user's own machine loads the Lighter API **private key** (from an OS
keychain or an env var **by name** — never a literal), manages the per-key
nonce, signs via the official **Python** (`elliottech/lighter-python`) or **Go**
(`elliottech/lighter-go`) SDK, submits `sendTx`, and records the tx hash.

> **NEVER paste a Lighter API private key (or auth token) into a chat, prompt,
> issue, log, or command argument.** No HISS surface will ever ask for one. If a
> user offers a key, refuse it and point them to the local-signer flow.

## API-key & nonce facts (for the local signer)

- **API key index**: 0–254; {0,1,2,3} reserved for web/mobile; use 4–254 for a
  programmatic key. Index 255 is the "all keys" query sentinel.
- **Auth token**: derived from the private key; standard token max **8h**;
  read-only token 1 day–10 years. Minted and kept **locally**.
- **Nonce**: **per API key**. Get it with `nextNonce`, or track locally, or set
  `SkipNonce=1` within `old < new < 2^47-1`. Maker orders advance the nonce only
  when the sequencer accepts; taker orders advance on a syntactically valid
  submission.

## Precision (never assume)

Prices and sizes go on the wire as **integers**; human value = integer /
10^decimals. Decimals are **per-market** (`supported_price_decimals`,
`supported_size_decimals`) — read them from `orderBooks`/`orderBookDetails`,
never hard-code. HISS's `prepareOrderIntent` scales for you and REJECTS a value
finer than the market tick, below `min_base_amount`, or below the `min_quote_amount`
notional. Example: AAPL/USDG is 2 price decimals / 4 size decimals, min base
0.02, min notional 10 USDG.

## Preparing an order intent (HISS side)

`prepareOrderIntent({ market, side, size, price, orderType, timeInForce,
clientOrderIndex, expiryMs?, reduceOnly?, integrator*?, maxNotional?,
maxInventory?, fuseChecksum?, strategyHash?, evidenceHash? })` returns
`{ ok, intent, errors }`.

- Order types: LIMIT, MARKET, STOP_LOSS(_LIMIT), TAKE_PROFIT(_LIMIT), TWAP.
- TIF: IMMEDIATE_OR_CANCEL, GOOD_TILL_TIME, POST_ONLY.
- `clientOrderIndex` is a caller-owned **uint48** idempotency key.
- GOOD_TILL_TIME requires an `expiryMs` between **5 minutes and 30 days** out.
- Partner attribution (optional): `integratorAccountIndex` + both
  `integratorTakerFee`/`integratorMakerFee` (≤ approved caps; max 4 partners
  per client).
- The **risk envelope** (maxNotional, maxInventory, fuseChecksum, strategyHash,
  evidenceHash) is recorded into the intent and its hash for lineage. Fuses only
  ever tighten — the local signer must re-check them against live state before
  signing and must never loosen them.

Fail-closed: any validation failure returns `{ ok:false, intent:null, errors }`
— never a partial intent.

## Execution-authority discovery

Before any live action, discover authority from live reads — never assume:
markets active (`orderBooks`), account tier / limits, integrator approval state,
and (for market making) that cancel-on-disconnect is handled. The WebSocket API
does **not** auto-cancel on disconnect; a live loop must cancel resting orders on
WS drop.

## Reconciliation & error recovery

After the local signer submits, HISS (read-only) reconciles by tx hash: accepted
(code 200) ≠ executed. Verify on-chain tx status (0 failed / 2 executed) and the
resulting order status (FILLED / canceled-family) plus fills, inventory, and
fees against the prepared `intentHash`. Classify any error by family with
`classifyLighterError()` (account / order / order_book / rate_limit / asset /
websocket / …). On `rate_limit` (429/405) back off (60s static firewall
cooldown). Missed GTT window / expiry → re-prepare. A `MARKET_NOT_AVAILABLE`
resolution means the ticker has no `/USDG` market — do not fabricate one.

## Hosted MCP tools (mcp.hiss.finance)

The hosted HISS MCP exposes this rail as **6 READ/PREPARE tools** — the same
read/prepare boundary, no hosted signer, no key:

- `hiss_lighter_markets` — list markets; `stockTokensOnly` filters to /USDG spot.
- `hiss_lighter_orderbook` — normalized book (bid/ask/mid/spread/depth) for one
  market (`symbol` | `ticker` | `marketId`).
- `hiss_lighter_depth` — compact top-of-book + depth summary (no full ladder).
- `hiss_lighter_prepare_order` — typed UNSIGNED order intent (`signed:false`).
- `hiss_lighter_prepare_cancel` — typed UNSIGNED cancel intent.
- `hiss_lighter_prepare_modify` — typed UNSIGNED modify intent.

Reads are fail-closed (`DEGRADED` / `MARKET_NOT_AVAILABLE`, never fabricated).
Every prepare returns `signed:false` + `liveTransactionSent:false` and is never
evidence anything reached the venue — sign + submit only in your own local
runtime. There is **no** hosted execute/sign/submit tool on this rail, ever.

## Rail status ladder (honest)

`READ ⊂ PREPARE ⊂ PAPER ⊂ USER_AUTHORIZED_LIVE`. HISS is at **PREPARE**. Do not
describe Lighter trading, paper trading, or market making as live. Advancing
requires the local signer plus fills, nonce, inventory/velocity/loss/stale-book
fuses, WS recovery, cancel-on-disconnect, and signer-key security — none of
which are HISS-hosted.
