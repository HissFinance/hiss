---
name: hiss-finance
description: Public agent guide to HISS Finance — compilation and verification software for Robinhood Chain. Covers the CoilOps planning pipeline (Coils, risk fuses, receipts), USDG Creator Vaults, xHISS staking and the 50/30/10/10 reward split, the Bankrbot → Robinhood MCP autonomy path, and tokenized stock-token trading — all under one rule set: HISS prepares and verifies; users' wallets, Safes, and their own broker/agent sessions sign and execute. HISS never takes custody, never stores credentials, and never places orders. Not affiliated with Robinhood, Bankr, or Chainlink. Not investment advice.
tags: [hiss, coilops, usdg-vaults, xhiss, staking, reward-split, bankrbot, robinhood-mcp, stock-tokens, robinhood-chain, agents]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Finance — Agent Skill Index

HISS is compilation and verification software on **Robinhood Chain**
(mainnet 4663, testnet 46630). It turns market ideas and vault manifests
into structured, hash-verified artifacts and reads verified on-chain state.
It **never** takes custody, **never** stores wallet or brokerage
credentials, **never** signs a transaction, and **never** places a
brokerage order. HISS is not a broker-dealer, investment adviser, custodian,
or order router, and is not affiliated with Robinhood, Bankr, or Chainlink.
Not investment advice.

Base URL for public APIs: `https://www.hiss.finance`.

## The one rule set (applies to every surface)

- **Prepare/verify only.** The user's wallet, the vault's owning Safe, or
  the user's own Bankr/Robinhood session signs and executes. HISS holds
  nothing.
- **`liveOrderSent: false`** is hard-typed in every artifact. Never claim an
  order or trade was sent, placed, or executed.
- **planned ≠ funded ≠ claimable.** A hash or prepared intent is data;
  funding is owner-gated and chain-verified; value is received only on an
  on-chain event.
- **A failed read is "unknown"** — never "not deployed", never "live".
- **No credentials, ever.** Credential-shaped inputs are rejected and never
  echoed; secrets are referred to by environment-variable NAME only.
- **Banned copy:** guaranteed yield/APY, projected APY, passive income,
  dividends, risk-free, "beat the market", "set and forget", personalized
  advice, external-audit claims.

## Skill packs (in `skills/`)

| Pack                       | What it covers                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `hiss-coilops`             | Coil the market thesis into a versioned, bounded playbook; validate, score, compile, receipt. |
| `hiss-risk-fuses`          | The typed, binding constraints that bound any compiled artifact.                              |
| `hiss-receipts`            | Canonical-JSON SHA-256 workflow-integrity proofs and verification.                            |
| `hiss-bankrbot-robinhood`  | The Bankrbot → HISS → Robinhood MCP autonomy path (paper-first, ack-gated).                   |
| `hiss-vault-agent-kit`     | Discover, read, create, and prepare deposits into USDG Creator Vaults.                        |
| `hiss-staking`             | Stake $HISS for xHISS; cooldown, redeem window, fee-funded injections.                        |
| `hiss-rewards`             | The 50/30/10/10 verified-fee split and the 2-of-3 Treasury Safe.                              |
| `hiss-stock-tokens`        | Prepare and reconcile Bankr trades of Robinhood Chain tokenized stocks (Rail B).              |
| `hiss-mcp`                 | Use the local HISS stdio MCP server and its tool families.                                    |
| `hiss-security-boundaries` | Custody, credential, consent, and rail boundaries — the invariants above, in depth.           |

## Public contract materials (in `contracts/`)

- `contracts/abi/*.json` — exact ABIs of the deployed contracts.
- `contracts/deployments/robinhood-chain-mainnet.json` — canonical
  addresses, bytecode hashes, verification status, explorer links (chain
  4663).
- `contracts/src/interfaces/*.sol` — Solidity interfaces for typed calls.

Key addresses (chain 4663): VaultFactory
`0x278d237c6890a5f7101296a9021ed9D26c821810` · flagship HISS Vault
`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` · xHISS vault
`0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` · $HISS token
`0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` · Treasury Safe (2-of-3)
`0xF100Fc28dd1721C698046Dbd60408c523b69e36c`. Explorer:
`https://robinhoodchain.blockscout.com`.

Always confirm deposit state, ownership, balances, and readiness with a live
chain read — never from a committed file.
