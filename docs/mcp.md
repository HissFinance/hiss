# MCP server

`@hiss-finance/mcp-server` is a local [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes HISS Finance to any MCP-compatible agent (Claude, and other MCP
clients). It registers **22 tools** (12 read, 10 prepare) — all of which **read or
prepare only**, so **agents never execute trades, move funds, or take custody**.
Preparation returns artifacts and unsigned transactions for a human or the user's
wallet to sign. The server's own `list_tools` response is always the source of truth.

## Running

```bash
pnpm --filter @hiss-finance/mcp-server start   # stdio transport
```

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

## The 22 tools

### Read tools (12)

- `hiss_get_protocol_status` — protocol status snapshot (network, token, Safe, vault count).
- `hiss_get_contract_registry` — deployed contract registry (name → address).
- `hiss_get_vaults` — list USDG Creator Vaults. Factual listing only — never a recommendation.
- `hiss_get_vault` — read a single vault by address or slug (deposit state is a live chain read).
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

### Prepare tools (10)

- `hiss_create_vault_candidate` — assemble a candidate VaultManifest (a draft — nothing is created).
- `hiss_validate_vault_candidate` — validate a manifest fail-closed (chain, USDG, fee bounds, skin, fuses).
- `hiss_prepare_vault_creation` — prepare an **unsigned** vault-creation transaction from a valid manifest.
- `hiss_prepare_vault_deposit` — prepare an **unsigned** USDG deposit transaction.
- `hiss_prepare_vault_withdrawal` — prepare an **unsigned** withdrawal transaction.
- `hiss_prepare_hiss_stake` — prepare an **unsigned** stake into the xHISS vault.
- `hiss_prepare_xhiss_cooldown` — prepare an **unsigned** cooldown (exits are user-initiated).
- `hiss_prepare_xhiss_redeem` — prepare an **unsigned** redeem within your open window.
- `hiss_validate_coil` — validate a CoilOps playbook manifest (local and deterministic).
- `hiss_compile_coil` — compile a coil manifest into a deterministic, hash-stamped plan (not execution).

> Bankr and Robinhood-MCP rails are **region- and provider-dependent**, have limited
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
