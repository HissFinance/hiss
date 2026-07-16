---
name: hiss-mcp
description: Use the HISS local MCP server — a stdio Model Context Protocol server that exposes HISS CoilOps, vault, staking, rewards, and stock-token tooling as callable tools for your own agent. Covers connecting the server, the tool families and their read/prepare-only contract, and the guards every tool output passes (execution-claim guard, credential rejection, planned ≠ funded ≠ claimable). Use when a user wants their agent to call HISS tools over MCP rather than raw HTTP. Compiles and verifies; never executes trades or custodies funds.
tags: [mcp, model-context-protocol, hiss-tools, agents, coilops]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS MCP Server

## Purpose

The HISS MCP server is a local **stdio** Model Context Protocol server that
exposes the HISS compilation/verification toolset to your own agent as
typed tools. It is a thin, deterministic surface over the same logic behind
the public `https://www.hiss.finance` HTTP routes: it PREPARES artifacts
(Coils, capsules, deposit intents, command packs, receipts) and READS
verified state. It never sends a transaction, never places an order, never
holds keys, and never takes custody.

Every tool output passes the execution-claim guard and carries
`liveOrderSent: false`. Any output that would imply HISS executed something
is blocked, not softened.

## Connecting

The server speaks MCP over stdio — launch it as a local process and point
your MCP-capable client at it (Claude Desktop, Claude Code, or any MCP
client) via that client's server configuration. No HISS credential is
required to run it; it calls only public HISS surfaces and public chain
reads. Never pass wallet keys, recovery phrases, or API credentials to any
tool — credential-shaped inputs are rejected and never echoed.

## Tool families

**CoilOps** — `hiss_generate_coil`, `hiss_validate_coil`, `hiss_score_coil`,
`hiss_risk_audit`, `hiss_create_receipt`, `hiss_verify_receipt`,
`hiss_export_share_card`, `hiss_explain_oracle_policy`. (See `hiss-coilops`,
`hiss-risk-fuses`, `hiss-receipts`.)

**Robinhood MCP / Bankrbot path** —
`hiss_compile_robinhood_capsule`,
`hiss_compile_bankrbot_robinhood_path`, `hiss_validate_autonomy_fuses`,
`hiss_generate_bankrbot_command_pack`,
`hiss_generate_robinhood_mcp_instructions`, `hiss_post_run_audit`. (See
`hiss-bankrbot-robinhood`, `hiss-security-boundaries`.)

**USDG Creator Vaults** — `hiss_validate_usdg_vault`,
`hiss_create_vault_manifest`, `hiss_compile_vault_rebalance_policy`,
`hiss_generate_vault_deposit_intent`, `hiss_generate_vault_receipt`,
`hiss_post_vault_rebalance_audit`, `hiss_calculate_vault_fees`,
`hiss_score_vault_risk`, `hiss_compare_vaults_without_recommendation`. (See
`hiss-vault-agent-kit`.)

**xHISS staking** — `hiss_get_xhiss_status`, `hiss_prepare_hiss_stake`,
`hiss_prepare_xhiss_cooldown`, `hiss_prepare_xhiss_redeem`,
`hiss_get_staking_position`, `hiss_get_reward_injection_history`. (See
`hiss-staking`.)

**Rewards & treasury** — `hiss_get_hiss_reward_split`,
`hiss_get_hiss_safe_status`. (See `hiss-rewards`,
`hiss-security-boundaries`.)

**Stock tokens (Bankr Rail B)** —
`hiss_prepare_bankr_stock_token_trade`,
`hiss_generate_bankr_stock_token_command`,
`hiss_submit_bankr_stock_token_intent` (gated),
`hiss_reconcile_bankr_stock_token_job`. (See `hiss-stock-tokens`.)

Tool names and counts evolve; treat the server's own tool list as
authoritative and this list as a map of the families.

## Hard rules for tool use

1. **Prepare/read only.** No tool executes a trade or a deposit. Signing and
   sending always belong to the user's wallet, Safe, or Bankr/Robinhood
   session.
2. **planned ≠ funded ≠ claimable.** A prepared intent or a split plan is
   data. Completion requires an on-chain receipt — never infer it from a
   tool's success.
3. **A failed read is "unknown"**, never "not deployed" and never "live".
4. **Fuses are binding.** Compilation tools refuse to weaken or drop a
   mandatory fuse.
5. **No credentials, ever.** Tools reject credential-shaped fields; pass
   wallet addresses and public inputs only.

## Example prompts

- "Using the HISS MCP tools, validate this Coil and write a receipt."
- "Call hiss_get_xhiss_status and tell me if staking is live."
- "Prepare a USDG vault deposit intent for the flagship vault."
- "Reconcile this Bankr stock-token trade by tx hash."
