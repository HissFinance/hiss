# MCP tool-name migration

Earlier drafts of the HISS docs and skill packs referenced tool names that were
never registered by the MCP server, or that mixed HTTP API routes and SDK methods
into the MCP namespace. This page records those names and their canonical
replacements.

The **canonical MCP tool set is generated from source**
(`packages/mcp-server/src/tools.ts`) — the server's own `list_tools` response is
authoritative, and `pnpm check:skill-tool-refs` fails CI if any skill or the docs
drift from it. The current registry has **22 tools** (12 read, 10 prepare); see
[MCP server](../mcp.md).

## Keep the interfaces separate

A HISS capability can be reachable over more than one interface. These namespaces
are **distinct** — a skill must never present an HTTP route or SDK method as an
MCP tool:

CLI commands are invoked through the `hiss` binary (see [CLI](../cli.md)); the CLI
column below shows the sub-command.

| Task                 | MCP tool                        | SDK                           | CLI (`hiss …`)           | HTTP                    |
| -------------------- | ------------------------------- | ----------------------------- | ------------------------ | ----------------------- |
| Protocol status      | `hiss_get_protocol_status`      | `getProtocolStatus()`         | `status`                 | —                       |
| List vaults          | `hiss_get_vaults`               | `getVaults()`                 | `vault list`             | `GET /api/vaults`       |
| Read a vault         | `hiss_get_vault`                | `getVault(addr)`              | `vault inspect`          | —                       |
| Vault holdings       | `hiss_get_vault_holdings`       | `getVaultHoldings(...)`       | `vault holdings`         | —                       |
| Vault performance    | `hiss_get_vault_performance`    | `getVaultPerformance(...)`    | `vault performance`      | —                       |
| Staking status       | `hiss_get_staking_status`       | `getStakingStatus()`          | `stake status`           | `GET /api/stake/status` |
| Prepare a deposit    | `hiss_prepare_vault_deposit`    | `prepareVaultDeposit(...)`    | `vault prepare-deposit`  | —                       |
| Prepare a withdrawal | `hiss_prepare_vault_withdrawal` | `prepareVaultWithdrawal(...)` | `vault prepare-withdraw` | —                       |
| Prepare a stake      | `hiss_prepare_hiss_stake`       | `prepareHissStake(...)`       | `stake prepare`          | —                       |
| Prepare a cooldown   | `hiss_prepare_xhiss_cooldown`   | `prepareXhissCooldown(...)`   | `stake cooldown`         | —                       |
| Prepare a redeem     | `hiss_prepare_xhiss_redeem`     | `prepareXhissRedeem(...)`     | `stake redeem`           | —                       |

`—` means no dedicated equivalent on that interface. Do not invent one.

## Legacy MCP names → canonical

These names were previously documented as MCP tools. Use the canonical name.

| Legacy name                          | Canonical name                  | Interface type | Removal status                                 |
| ------------------------------------ | ------------------------------- | -------------- | ---------------------------------------------- |
| `hiss_get_xhiss_status`              | `hiss_get_staking_status`       | LEGACY_ALIAS   | replaced (never registered under the old name) |
| `hiss_get_staking_position`          | `hiss_get_staking_status`       | LEGACY_ALIAS   | folded into staking status                     |
| `hiss_get_hiss_reward_split`         | `hiss_get_reward_status`        | LEGACY_ALIAS   | replaced                                       |
| `hiss_get_hiss_safe_status`          | `hiss_get_protocol_status`      | LEGACY_ALIAS   | folded into protocol status                    |
| `hiss_calculate_vault_fees`          | `hiss_get_fee_schedule`         | LEGACY_ALIAS   | replaced                                       |
| `hiss_create_vault_manifest`         | `hiss_create_vault_candidate`   | LEGACY_ALIAS   | replaced                                       |
| `hiss_validate_usdg_vault`           | `hiss_validate_vault_candidate` | LEGACY_ALIAS   | replaced                                       |
| `hiss_generate_vault_deposit_intent` | `hiss_prepare_vault_deposit`    | LEGACY_ALIAS   | replaced                                       |

## Reclassified: HTTP API, not MCP tools

These capabilities exist **only over the HTTP API** on `https://www.hiss.finance`
and were never MCP tools. Reference the HTTP route (or the CoilOps MCP tools where
applicable), not an MCP tool name.

| Former name                            | Interface type   | Replacement / route                         |
| -------------------------------------- | ---------------- | ------------------------------------------- |
| `hiss_generate_coil`                   | HTTP_API_NOT_MCP | `POST /api/tools/generate-coil`             |
| `hiss_score_coil`                      | HTTP_API_NOT_MCP | `POST /api/tools/score-coil`                |
| `hiss_create_receipt`                  | HTTP_API_NOT_MCP | `POST /api/tools/receipt`                   |
| `hiss_export_share_card`               | HTTP_API_NOT_MCP | `POST /api/tools/share-card`                |
| `hiss_risk_audit`                      | HTTP_API_NOT_MCP | `POST /api/tools/risk-audit`                |
| `hiss_compile_bankrbot_robinhood_path` | HTTP_API_NOT_MCP | `POST /api/bankrbot/compile-robinhood-path` |
| `hiss_validate_autonomy_fuses`         | HTTP_API_NOT_MCP | `POST /api/bankrbot/validate-autonomy`      |
| `hiss_generate_bankrbot_command_pack`  | HTTP_API_NOT_MCP | `POST /api/bankrbot/generate-command-pack`  |
| `hiss_post_run_audit`                  | HTTP_API_NOT_MCP | `POST /api/bankrbot/post-run-audit`         |
| `hiss_prepare_bankr_stock_token_trade` | HTTP_API_NOT_MCP | `POST /api/stocks/prepare-bankr-command`    |
| `hiss_submit_bankr_stock_token_intent` | HTTP_API_NOT_MCP | `POST /api/stocks/submit-bankr-intent`      |
| `hiss_reconcile_bankr_stock_token_job` | HTTP_API_NOT_MCP | `POST /api/stocks/reconcile-receipt`        |
| `hiss_get_reward_injection_history`    | HTTP_API_NOT_MCP | `GET /api/stake/reward-injections`          |

Other former names — `hiss_compile_robinhood_capsule`,
`hiss_generate_robinhood_mcp_instructions`, `hiss_generate_vault_receipt`,
`hiss_compile_vault_rebalance_policy`, `hiss_post_vault_rebalance_audit`,
`hiss_score_vault_risk`, `hiss_compare_vaults_without_recommendation`,
`hiss_explain_oracle_policy` — were preview/documentation labels with no public
MCP tool. They have been removed from the MCP surface; use the HTTP routes above
where a public equivalent exists.

## Reward-cohort rename (V1 → V2)

Reward Method **V2** renamed the reward cohort formerly called "depositor" to
**Vault Contributors** (and standardized "provider" as **Vault Providers**). The
methodology is unchanged — only the names moved. The on-chain **contract artifacts
keep their deployed names** (e.g. the `VaultDepositorRewardsDistributor` ABI); only
the client-facing SDK/CLI identifiers changed.

| Task                        | SDK (was → now)                                              | CLI (`hiss …`) (was → now)                                      |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Read a contributor's reward | `getDepositorReward(...)` → `getVaultContributorReward(...)` | `rewards depositor <address>` → `rewards contributor <address>` |

The vault **deposit action** (`prepareVaultDeposit`, `vault prepare-deposit`) is
unchanged — only the reward-cohort name changed.

## Not a tool

`hiss_trading_fee` is a **source-classification label** (the fee-delta class used
by the [reward split](../fees/reward-flywheel.md)), not a tool of any kind.

## Enforcement

`pnpm check:skill-tool-refs` reads the canonical registry from source, the
per-skill `required_mcp_tools` metadata, and the reviewed allowlist
(`scripts/canonical/non-mcp-tokens.json`), and fails on any unknown tool, any
HTTP/SDK name presented as an MCP tool, any private/internal reference, and any
tool-count claim that disagrees with the registry.
