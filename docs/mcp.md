# MCP server

`@hiss-finance/mcp-server` is a local [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes HISS Finance to any MCP-compatible agent (Claude, and other MCP
clients). It ships **45 tools**, all of which **read, prepare, or score** — **agents
never execute trades, move funds, or take custody**. Preparation returns artifacts and
unsigned transactions for a human or the user's wallet to sign.

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

## The 45 tools

### Vaults — create, score, fees, receipts

- `hiss_create_vault_manifest` — compose a vault manifest.
- `hiss_calculate_vault_fees` — preview performance-fee / protocol-share math.
- `hiss_validate_usdg_vault` — validate a USDG vault manifest and fuses.
- `hiss_validate_autonomy_fuses` — validate autonomy/risk fuses.
- `hiss_score_vault_risk` — facts-based vault risk score (no performance inputs).
- `hiss_compare_vaults_without_recommendation` — compare vaults without advising.
- `hiss_generate_vault_receipt` / `hiss_create_receipt` — build a receipt.
- `hiss_verify_receipt` — verify a receipt's integrity.
- `hiss_generate_vault_deposit_intent` — prepare a deposit intent.
- `hiss_export_share_card` — export a share card.
- `hiss_explain_oracle_policy` — explain the oracle-freshness policy.

### Rebalance & CoilOps — compile, validate, audit

- `hiss_generate_coil` — generate a CoilOps compile artifact.
- `hiss_validate_coil` — validate a coil.
- `hiss_score_coil` — score a coil.
- `hiss_compile_vault_rebalance_policy` — compile a rebalance policy.
- `hiss_compile_robinhood_capsule` — compile a Robinhood capsule.
- `hiss_compile_bankrbot_robinhood_path` — compile a Bankr → Robinhood path.
- `hiss_drift_check` — check basket/vault drift.
- `hiss_risk_audit` — run a risk audit.
- `hiss_post_run_audit` — post-run audit artifact.
- `hiss_post_vault_rebalance_audit` — audit a completed vault rebalance.
- `hiss_prepare_vault_bankr_rebalance` — prepare (never execute) a Bankr rebalance.

### Staking (xHISS)

- `hiss_get_xhiss_status` — live xHISS vault status.
- `hiss_get_staking_position` — a staker's position.
- `hiss_prepare_hiss_stake` — prepare a stake.
- `hiss_prepare_xhiss_cooldown` — prepare a cooldown.
- `hiss_prepare_xhiss_redeem` — prepare a redeem.
- `hiss_get_reward_injection_history` — reward-injection history.

### Rewards & Treasury

- `hiss_get_hiss_reward_split` — the 50/30/10/10 split plan.
- `hiss_get_reward_epoch_status` — epoch lifecycle status.
- `hiss_get_depositor_reward_status` — depositor leg status.
- `hiss_get_provider_reward_status` — provider leg status.
- `hiss_plan_provider_rewards` — plan a provider epoch (data only).
- `hiss_import_bankr_fee_claim` — import a $HISS fee claim for classification.
- `hiss_get_hiss_safe_status` — Treasury Safe (2-of-3) status.

### Bankr rails (prepare / reconcile)

- `hiss_generate_bankrbot_deposit_command` — build a Bankr deposit command.
- `hiss_prepare_bankrbot_vault_deposit` — prepare a Bankr vault deposit.
- `hiss_reconcile_bankrbot_deposit_receipt` — reconcile a deposit against its receipt.
- `hiss_generate_bankrbot_command_pack` — a pack of Bankr commands.
- `hiss_generate_bankr_stock_token_command` — build a stock-token command.
- `hiss_prepare_bankr_stock_token_trade` — prepare a stock-token trade.
- `hiss_submit_bankr_stock_token_intent` — submit a stock-token intent (unconfirmed).
- `hiss_reconcile_bankr_stock_token_job` — reconcile a stock-token job.
- `hiss_generate_robinhood_mcp_instructions` — generate Robinhood-MCP planning text.
- `hiss_compile_robinhood_capsule` — (see rebalance) compile a Robinhood capsule.

> Bankr and Robinhood-MCP rails are **region- and provider-dependent**, have limited
> rollout, and are **planning/preparation only**. An intent submitted is **not**
> settled; only an on-chain confirmation counts. See [Bankrbot](./bankrbot.md) and
> [Stock Tokens](./stock-tokens.md).

## Building your own agent flows

Combine tools into read → score → prepare pipelines. Example: `hiss_get_xhiss_status`
→ `hiss_prepare_hiss_stake` → hand the unsigned transaction to the user's wallet. The
server never closes that loop for the user — signing is always the user's.

See also [Agent skills](./agent-skills.md), [x402](./x402.md), and
[CoilOps](./coilops.md).
