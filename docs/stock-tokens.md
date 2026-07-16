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
