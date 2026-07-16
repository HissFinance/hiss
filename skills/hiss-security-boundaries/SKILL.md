---
name: hiss-security-boundaries
description: State the HISS trust, custody, and consent boundaries truthfully — HISS never takes custody, never stores brokerage or wallet credentials, never places orders, and never collects location; the three Bankr rails are never conflated; autonomy requires an explicit LiveAutonomyAck; and the planned ≠ funded ≠ claimable state chain and execution-claim guard bind every surface. Use whenever an agent touches custody, credentials, autonomy modes, live-readiness, rail boundaries, or risk copy.
tags: [security, boundaries, custody, consent, credentials, rails, autonomy]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Security Boundaries

HISS is compilation/verification software. It prepares artifacts and reads
verified state. It **never** takes custody of funds, **never** stores or
accepts wallet or brokerage credentials, **never** places brokerage orders,
**never** signs a transaction, and **never** collects or verifies location.
HISS is not a broker-dealer, investment adviser, custodian, or order router,
and is not affiliated with Robinhood, Bankr, or Chainlink.

## The invariants (never violate, on any surface)

1. **No custody, no keys.** The user's own wallet or the vault's owning Safe
   signs and sends everything. HISS holds nothing.
2. **No credentials, ever.** Every route and tool rejects credential-shaped
   fields (wallet keys, recovery phrases, passwords, OAuth tokens, session
   cookies, API keys) and never echoes the value. Credentials are referred
   to by environment-variable NAME only, never by value.
3. **No execution claims.** Every artifact carries `liveOrderSent: false`.
   Never say "we bought", "we sold", "order sent", "trade executed", "HISS
   executed", or "HISS placed". The output guard blocks these; never
   paraphrase around it. Treat any artifact claiming `liveOrderSent: true`
   as forged.
4. **planned ≠ funded ≠ claimable.** A hash or a prepared intent is data;
   funding is owner-gated and chain-verified; value is received only via an
   on-chain event. Never report a later state from an earlier one.
5. **A failed read is "unknown"** — never "not deployed", never "live".
   Negative claims require affirmative evidence.
6. **Two symbol spaces, never confused.** Brokerage tickers live in
   capsules; Robinhood Chain `0x` token addresses never appear as tickers
   (`SYMBOL_SPACE_CONFUSION`).

## The three Bankr rails (never conflated)

- **Rail A — vault deposits.** USDG deposits into HISS USDG Creator Vaults;
  `hissExecutesDeposit: false`; complete only on the on-chain receipt.
- **Rail B — stock-token trading.** Bankr executes tokenized stock/ETF
  trades on Robinhood Chain, USDG settlement; commands end "on robinhood";
  `job_completed_unconfirmed` ≠ settled; only `onchain_confirmed` counts.
  (See `hiss-stock-tokens`.)
- **Rail C — rh-wallet.** An optional, **external** Bankr skill for a user's
  own connected Robinhood Crypto account. Its public documentation is
  **source-pending**. HISS does not depend on it and never uses it for
  pooled vault execution. Any credentials a user opts to configure live in
  Bankr's own environment, entirely outside HISS.

Separately, CoilOps' Robinhood MCP layer is a per-user, brokerage-side
compile surface — `liveOrderSent` always false, never a pooled vault rail.

### rh-wallet: banned claims (never publish)

- "rh-wallet is supported by HISS"
- "HISS connects to your Robinhood Crypto account"
- "HISS stores your Robinhood credentials"
- "Trade your Robinhood Crypto account through HISS"

## Autonomous trading consent (Bankrbot → Robinhood MCP)

Autonomy modes: `paper` (default) → `preview` (compiles a capsule, checks
readiness, cannot place orders) → `live_candidate` (HISS readiness checks
passed; still not execution — HISS sends nothing). Graduating to
`live_candidate` requires the explicit **LiveAutonomyAck**; no mode string,
prior message, or inferred enthusiasm substitutes for it. Any live order, if
the user enables one, happens only inside the user's own Robinhood Agentic
Account through the user's own authorized Robinhood MCP connection.

**LiveAutonomyAck** — all nine booleans literally `true`, plus a valid
ISO-8601 timestamp; agents never fabricate, pre-check, or reuse an ack:

```json
{
  "acknowledgedAgentCanTradeWithoutPerOrderInput": true,
  "acknowledgedLossOfPrincipalRisk": true,
  "acknowledgedUserResponsibleForMonitoring": true,
  "acknowledgedUserResponsibleForAgentInstructions": true,
  "acknowledgedOrdersMayAppearInRobinhoodActivityAndHistory": true,
  "acknowledgedLongEquitiesAndOptionsOnlyUnlessDocsChange": true,
  "acknowledgedOptionsRiskIfOptionsEnabled": true,
  "acknowledgedHissNoCredentialsNoOrders": true,
  "acknowledgedNotInvestmentAdvice": true,
  "timestamp": "ISO-8601 string"
}
```

The ten mandatory autonomy fuses (all required, allocation bps sum exactly
to 10,000): `allowedTickers`, `maxNotionalPerOrderUsd`,
`maxDailyNotionalUsd` (≥ per-order cap), `maxPortfolioAllocationPerSymbolBps`
((0, 10000]), `maxRebalanceFrequency`, `marketHoursPolicy`,
`slippageLimitPolicy`, `stopConditions` (non-empty), `receiptLogging: true`,
`postRunAuditRequired: true`.

## Fail-closed rules

Missing fuse → fail. Invalid bps sum → fail. Conflicting caps → fail.
Credential-looking field → reject without echo. `live_candidate` without a
valid LiveAutonomyAck → fail (`LIVE_ACK_REQUIRED`). Request to recommend a
specific security → refuse; offer user-authored Coil structuring. Request
for HISS to execute a trade → explain HISS has no execution rail. Low-
confidence fee classification, absent owner flag, or hash mismatch → refuse.

## Banned language

Never "guaranteed returns", "safe profits", "risk-free", "passive income",
"guaranteed yield/APY", "projected APY", "dividends", "beat the market",
"set and forget", "personalized advice", or "externally audited". Approved
staking review wording, verbatim: "No known unresolved Critical or High
findings after internal launch review." (Internal review — never an external
audit.)

## Mandatory disclaimers (verbatim where risk copy is needed)

- "HISS is not a broker-dealer, investment adviser, custodian, or order router."
- "HISS does not provide personalized investment advice."
- "HISS does not store Robinhood credentials."
- "HISS does not send live orders from the web app."
- "Autonomous trading involves substantial risk, including loss of principal."
- "Users are responsible for monitoring agents, account activity, and positions."
- "Tokenized stocks are economic exposure, not direct share ownership, and may be region- or provider-restricted."

## Related packs

`hiss-bankrbot-robinhood` · `hiss-stock-tokens` · `hiss-vault-agent-kit` ·
`hiss-staking` · `hiss-rewards` · `hiss-mcp`.
