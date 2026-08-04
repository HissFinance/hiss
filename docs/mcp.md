# MCP server

`@hiss-finance/mcp-server` is a local [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes HISS Finance to any MCP-compatible agent (Claude, and other MCP
clients). It registers **39 tools** (21 read, 18 prepare) — all of which **read or
prepare only**, so **agents never execute trades, move funds, or take custody**.
Preparation returns artifacts and unsigned transactions for a human or the user's
wallet to sign. The server's own `list_tools` response is always the source of truth.

## Running

Two transports expose the **same** tools and handlers (one `createServer()`
factory — identical behavior, identical guards):

```bash
pnpm --filter @hiss-finance/mcp-server start        # stdio transport   (hiss-mcp)
pnpm --filter @hiss-finance/mcp-server start:http   # Streamable HTTP   (hiss-mcp-http)
```

The HTTP server is stateless (no session state; a fresh server + transport per
request), serves `POST /mcp` plus a `GET /healthz` liveness probe, and binds to
`127.0.0.1:8730` by default (`HISS_MCP_HTTP_HOST` / `HISS_MCP_HTTP_PORT`).

Example client config (stdio):

```jsonc
{
  "mcpServers": {
    "hiss": { "command": "pnpm", "args": ["--filter", "@hiss-finance/mcp-server", "start"] },
  },
}
```

## Safety model

- **Prepare, never execute.** Deposit/stake/trade tools generate intents and unsigned
  transactions; `liveOrderSent`-style flags are hard-typed false where they exist.
- **No credentials.** Tools reject credential-shaped fields; nothing accepts a private
  key, RPC secret, or API token.
- **Execution-claim guard.** Every tool output passes an honesty guard so no result
  can claim an order was placed or funds moved.
- **Fail closed.** Missing artifacts, low-confidence classification, or missing
  authorization refuse.

## The 39 tools

### Read tools (21)

- `hiss_get_protocol_status` — protocol status snapshot (network reachability, current
  block, vault lifecycle facts: the canonical V2 new-deposit vault + the legacy V1 flagship).
- `hiss_get_contract_registry` — deployed contract registry (name → address).
- `hiss_get_vaults` — list USDG vaults: the canonical V2 new-deposit vault first, then
  the legacy V1 flagship as a separately labeled LEGACY entry (closed to new deposits —
  never the deposit default). Factual listing only — never a recommendation.
- `hiss_get_vault` — read a single vault by address or slug (a non-address ref resolves
  to the canonical V2 vault). For the canonical V2 vault the result attaches the live
  `v2Status` lane snapshot: queue, keeper, rebalancing (owner-declared inactive by
  policy — not a fault state), and capacity (a live Price Mesh read). All state is a
  live chain read, never assumed.
- `hiss_get_vault_holdings` — a vault's current holdings from a live chain read.
- `hiss_get_vault_performance` — historical performance (not a forecast, not a performance claim).
- `hiss_get_staking_status` — xHISS staking status (not a performance claim).
- `hiss_get_reward_status` — reward-split status for the 50/15/15/10/10 split (xHISS
  stakers / Vault Providers / Vault Contributors / Treasury / economic burn to the dead
  address). planned ≠ funded ≠ claimable.
- `hiss_get_receipt` — read a HISS receipt by id.
- `hiss_verify_receipt` — verify a receipt's integrity hash locally (on-chain settlement is separate).
- `hiss_get_supported_assets` — source-verified assets vaults may hold.
- `hiss_get_fee_schedule` — the current HISS fee schedule (vault fees and the five
  reward-split legs).
- `hiss_stock_token_registry` — the dynamic, admission-gated Robinhood Chain Stock-Token
  registry (canonical address is identity; a matching ticker is never sufficient).
- `hiss_stock_premium_scan` — scan Stock-Token premium/discount, ranked by a bounded,
  amount-aware, risk-adjusted score. Fees are not profit; a premium is a size-dependent,
  uncertain edge.
- `hiss_stock_premium_explain` — amount-aware, direction-specific premium evidence for one
  Stock Token (raw reference, multiplier-once, executable price, impact, capacity, fuse verdict).
- `hiss_lp_ladder_preview` — preview a one-sided Uniswap v3 USDG range-ladder with its full
  honest cost + inventory model. Preview only.
- `hiss_lp_position_read` — read a Uniswap v3 LP position by tokenId (a value that cannot be
  read is null, never zero).
- `hiss_lp_verify_receipt` — verify a Stock-Premium LP receipt's integrity hash locally
  (a preparation receipt is never evidence of on-chain settlement).
- `hiss_lighter_markets` — list public Lighter (Robinhood-instance) markets; classifies the
  USDG-quoted Stock-Token spot pairs. Fail-closed to `DEGRADED`; never a fabricated market.
- `hiss_lighter_orderbook` — normalized Lighter orderbook for one market (bid/ask/mid/spread/
  depth). An empty/one-sided book is `null` (UNKNOWN), never a fabricated mid.
- `hiss_lighter_depth` — compact Lighter top-of-book + aggregate per-side depth (no full ladder).

### Prepare tools (18)

- `hiss_create_vault_candidate` — assemble a candidate VaultManifest (a draft — nothing is created).
- `hiss_validate_vault_candidate` — validate a manifest fail-closed (chain, USDG, fee bounds, skin, fuses).
- `hiss_prepare_vault_creation` — prepare an **unsigned** vault-creation transaction from a valid manifest.
- `hiss_prepare_vault_deposit` — prepare an **unsigned** USDG deposit. For the canonical
  V2 vault this is a request-queue enqueue (epoch batch settlement — shares mint at
  settlement, not at enqueue); a legacy-V1-targeted plan carries an explicit legacy warning.
- `hiss_prepare_vault_withdrawal` — prepare an **unsigned** withdrawal. For the canonical
  V2 vault the default is the pro-rata in-kind redemption (24/7); mode `queue_usdg`
  prepares a queue-routed USDG redemption instead.
- `hiss_prepare_hiss_stake` — prepare an **unsigned** stake into the xHISS vault.
- `hiss_prepare_xhiss_cooldown` — prepare an **unsigned** cooldown (exits are user-initiated).
- `hiss_prepare_xhiss_redeem` — prepare an **unsigned** redeem within your open window.
- `hiss_validate_coil` — validate a CoilOps playbook manifest (local and deterministic).
- `hiss_compile_coil` — compile a coil manifest into a deterministic, hash-stamped plan (not execution).
- `hiss_lp_prepare_mint` — prepare a typed **unsigned** one-sided USDG LP mint package (a bounded
  buy ladder) for the user's own authority. Fail-closed; nothing is signed or sent.
- `hiss_lp_prepare_increase` — prepare a typed **unsigned** increaseLiquidity package (exact, never
  unbounded, approvals).
- `hiss_lp_prepare_withdraw` — prepare a typed **unsigned** decreaseLiquidity (withdraw) package.
- `hiss_lp_prepare_collect` — prepare a typed **unsigned** collect package (fees to the user's own recipient).
- `hiss_lp_prepare_close` — prepare a typed **unsigned** burn (close) package for a fully-exited position.
- `hiss_lighter_prepare_order` — prepare a typed **unsigned** Lighter order intent (precision-scaled
  integers, expiry-bound, HISS risk envelope, deterministic `intentHash`). `signed:false`; nothing sent.
- `hiss_lighter_prepare_cancel` — prepare a typed **unsigned** Lighter cancel intent for one resting order.
- `hiss_lighter_prepare_modify` — prepare a typed **unsigned** Lighter modify intent (new size and/or price).

> Lighter signing happens only in the user's own local runtime (official Python/Go SDK) — HISS holds
> no Lighter API key, auth token, or nonce and submits nothing. Bankr and Robinhood-MCP rails are **region- and provider-dependent**, have limited
> rollout, and are **planning/preparation only** — they are documented separately and
> are not part of this MCP tool set. An intent submitted is **not** settled; only an
> on-chain confirmation counts. See [Bankrbot](./bankrbot.md) and
> [Stock Tokens](./stock-tokens.md).

## Tool-name migration

Older drafts referenced tool names that were never registered, or mixed HTTP/SDK
names into the MCP namespace. See [tool-name migration](./mcp/tool-name-migration.md)
for the legacy → canonical mapping and the per-interface (MCP / SDK / CLI / HTTP)
equivalents. `pnpm check:skill-tool-refs` enforces this against the generated
registry.

## Robinhood MCP capability manifest (agentic-trading skills)

The HISS MCP server above is HISS's own local read/prepare surface. It is **not** the
Robinhood Trading MCP and never proxies it. The agentic-trading skills
([`hiss-robinhood-agentic`](../skills/hiss-robinhood-agentic/SKILL.md) and the focused
packs it hands off to) instead drive the **user's own** connection to Robinhood's
official Trading MCP, in the user's own Agentic account, under the user's own OAuth and
a signed autonomy grant. HISS compiles/verifies (`liveOrderSent: false`); the user's
session executes.

Those skills declare against a **capability-family model**, not per-skill tool lists:
each skill names capability-family ids (e.g. `market_data`, `equities`, `options`,
`scanner`, `account_portfolio_other`, `watchlist`) and discovers the concrete tools at
session time. The sanitized machine-readable manifest lives under
[`schemas/robinhood-mcp/`](../schemas/robinhood-mcp/):

- `capability-snapshot.sanitized.json` — the documented capability surface, one entry
  per tool, with an explicit `UNKNOWN` for every fact not confirmed from an authorized
  session (schemas, order types, rate limits, pagination).
- `capability-family-map.json` — the family → capability grouping the skills declare.
- `capability-manifest.schema.json` — the JSON schema for the manifest.

Discovery is **fail-closed**: every `UNKNOWN` is treated as not-available and
not-permitted until an authorized session proves it. HISS-hosted services never call
any Robinhood Trading MCP tool. See [`skills/skill-catalog.json`](../skills/skill-catalog.json)
for each pack's required capability families and safety metadata.

## Building your own agent flows

Combine tools into read → prepare pipelines. Example: `hiss_get_staking_status`
→ `hiss_prepare_hiss_stake` → hand the unsigned transaction to the user's wallet. The
server never closes that loop for the user — signing is always the user's.

See also [Agent skills](./agent-skills.md), [x402](./x402.md), and
[CoilOps](./coilops.md).
