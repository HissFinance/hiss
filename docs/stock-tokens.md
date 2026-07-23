# Stock Tokens

Robinhood Chain hosts **tokenized Stock Tokens and ETF tokens** — on-chain instruments
that track equities and ETFs. HISS vaults reference them by **canonical address only**.
Understanding what they are — and are not — is essential.

## Economic exposure, not ownership

**Tokenized Stock Tokens and ETF tokens are economic exposure only.** They confer:

- **No legal or beneficial ownership** of the underlying company or fund.
- **No voting rights.**
- **No direct dividend entitlement** (any economic treatment is a property of the token,
  not a shareholder right).

They are not shares. Holding a tokenized AAPL is **not** owning Apple stock.

## Regional restrictions

Availability of Stock Tokens and related rails is **jurisdiction-restricted**. Some
regions are excluded, and some HISS/agent surfaces are limited-rollout and
region-gated. Never assume universal availability; every surface that offers them must
state the constraint. Vault manifests carry a `jurisdictionAckRequired` acknowledgement
and a jurisdiction gate.

## How HISS uses them

- **Canonical addresses only.** Vaults reference Stock/ETF tokens via the
  `VaultAssetRegistry`, which pins canonical addresses. Look-alike or unverified tokens
  are not allowed.
- **Oracle-guarded pricing.** Prices come through the oracle adapter with staleness
  handling suited to a **24/5** market (`feed-aware-24-5`, `requireFreshFeeds`, max
  staleness). Stale-fed assets are not treated as live-rebalanceable.
- **Corporate-action awareness.** Tokenized instruments can carry UI multipliers for
  corporate actions; HISS surfaces treat these as data, not as ownership events.

## Liquidity and trading venues

Stock Tokens on Robinhood Chain draw liquidity from several venues. Builders can
leverage these directly; HISS itself only **prepares and verifies** — it provides
no liquidity, quotes no fills, and places no orders.

- **AMM pools** — Uniswap-style on-chain pools give composable liquidity that
  smart-contract flows integrate directly. HISS vault rebalancing routes through
  AMM liquidity, oracle-guarded and slippage-bounded.
- **propAMM (proprietary AMM)** — market-maker-backed on-chain AMMs such as
  **Rialto**. Because a propAMM is on-chain, it offers composable liquidity that
  DeFi apps can integrate directly into smart-contract flows — unlike RFQ, which
  relies on off-chain signed quotes.
- **RFQ (request-for-quote)** — off-chain signed market-maker quotes sourced
  through aggregators; wallets and apps integrate those aggregators as a liquidity
  source. Named aggregators include **0x RFQ**, **1inch Fusion**, and **LiFi**.
- **Direct mint & burn** — reserved for authorized participants and market makers;
  the ultimate source of Stock Token supply that underpins secondary-market
  liquidity.
- **Orderbook** — Stock Tokens also trade on **Lighter** (spot and perpetuals).

A reference quote from any venue is **not** an executable fill — always separate a
reference price from what a specific size can actually transact (the same
reference-vs-executable separation the HISS agent skills enforce). Venue and
liquidity availability are **region-gated** like the tokens themselves.

On-chain 24/7 stock-token liquidity is **real but thin and single-venue today**:
proven per-asset USDG pools exist on the AMM, but depth is shallow and only one
venue is code-verified (propAMM, RFQ, and orderbook venues remain discovered, not
proven). The designed (undeployed, activation-gated)
[24/7 vault architecture](./vaults/24-7-architecture.md) is staged to this measured
reality — size-aware execution, dynamic safe-notional, and an in-kind exit — rather
than assuming depth the pools do not have. Production 24/7 settlement is **not
active**.

Authoritative source: Robinhood's
[Building with Stock Tokens — Trading Venues & Liquidity](https://docs.robinhood.com/chain/building-with-stock-tokens/#trading-venues--liquidity).

## Representative assets

The flagship vault's allowed set includes mega-cap tech (AAPL, MSFT, NVDA, GOOGL, AMZN,
META), tokenized ETFs (SPY, QQQ, SGOV, SLV), and USDG cash. A vault may only hold assets
in its manifest's `allowedAssetSymbols`, each resolvable to a canonical address.

## Trading them via agents

Stock-token trading through Bankr (Rail B) is **prepare-and-reconcile only**: an
unconfirmed job is **not** settled, and only an `onchain_confirmed` result counts. HISS
never executes the trade. See [Bankrbot](./bankrbot.md). Any Robinhood-MCP surface is
**compile-only** and never used for pooled vault execution.

## Honesty rules

- Always state **economic exposure, not ownership**.
- Always state that availability is **region-restricted** where offered.
- **No guaranteed yield**, no dividend framing, no "direct stock ownership".
- HISS is **not affiliated with Robinhood** and is not a broker.
