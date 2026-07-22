---
name: hiss-vault-agent-kit
description: Let your own AI agent discover, read, create, and help operate HISS USDG Creator Vaults on Robinhood Chain through the existing gated HISS APIs — nothing new on-chain. Covers vault discovery, reading a vault's manifest / strategy hash / fees / source verification, creating a vault CANDIDATE from a validated manifest plus the VaultCreatorAck, preparing a USDG deposit intent with the VaultDepositorAck and the exact depositWithAcks ack hashes, checking the deposit-readiness gate, and previewing rebalances under fuses. HISS prepares and verifies; the user's wallet or Safe signs; HISS never deploys, custodies, or executes. Use when a user wants their agent to work with HISS vaults.
tags: [vaults, usdg, robinhood-chain, creator-vaults, deposits, manifest, receipts, agent-kit]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_vaults
  - hiss_get_vault
  - hiss_get_vault_holdings
  - hiss_get_vault_performance
  - hiss_get_supported_assets
  - hiss_get_fee_schedule
  - hiss_create_vault_candidate
  - hiss_validate_vault_candidate
  - hiss_prepare_vault_creation
  - hiss_prepare_vault_deposit
  - hiss_prepare_vault_withdrawal
  - hiss_verify_receipt
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Vault Agent Kit (USDG Creator Vaults)

## Purpose

This pack lets a user's own AI agent work with HISS USDG Creator Vaults on
Robinhood Chain (mainnet 4663, testnet 46630) through the HISS APIs that
already exist. HISS is compilation and verification software: it prepares
manifests, deposit intents, and receipts, and verifies on-chain state. It
never deploys a vault for you, never custodies funds, never holds keys, and
never sends a transaction. Every route returns `notInvestmentAdvice: true`
and `liveOrderSent: false`, and every response passes the execution-claim
guard and the vault copy guard.

Base asset: USDG (6 decimals). USDG's home chain is never a vault chain — a
manifest with any other `chainId` returns `400 VAULT_CHAIN_INVALID`.

## Required statements (say these; never contradict them)

- **The agent PREPARES; the user's wallet or Safe SIGNS.** No HISS route
  sends a transaction. Deploying, depositing, withdrawing, and rebalancing
  are all signed by the relevant wallet or the vault's owning Safe.
- **HISS takes no custody** of funds and holds no keys.
- **No performance guarantee.** HISS never promises yield, APY, returns, or
  a managed outcome. Depositors share profits and losses. Not FDIC insured.
- **Target allocations are not current holdings.** A manifest's weights are
  a target the strategy aims toward, never a claim about what a vault holds
  right now — read holdings live on chain.
- **Tokenized stocks are economic exposure, not direct share ownership**,
  and may be region- or provider-restricted; issuer-side restrictions are
  per-asset disclosures the depositor acknowledges, never a HISS gate.

## What your agent CAN do (real endpoints, base `https://app.hiss.finance`)

(The canonical API base is `https://app.hiss.finance`;
`https://www.hiss.finance` continues to serve the same routes for
compatibility.)

**Discover**

| Route                            | Returns                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/vaults/schema`         | Machine-readable route list, chain/payment model, fee schedule, deposit-readiness gate, source verification.                                                                                                                                      |
| `GET /api/vaults`                | `deployedVaults[]` (live, deposit-open vaults) + `vaults[]` (saved candidates, not deployed).                                                                                                                                                     |
| `GET /api/vaults/marketplace`    | Marketplace rows; paid placement is disclosed and never implies safety or expected return.                                                                                                                                                        |
| `GET /api/vaults/asset-registry` | Source-verified Robinhood Chain assets + USDG policy. Live rebalancing is disabled on every asset today.                                                                                                                                          |
| `GET /api/vaults/readiness`      | Live chain-health + canonical contract status, plus `flagshipVault` with its DEPLOYED address, live `deposits.open`, deposit params, and a `doNotUse` implementation-address warning. Authoritative for "are contracts live / are deposits open". |

**Deposit into the live flagship vault (READ BEFORE ANY DEPOSIT)**

The flagship **HISS Vault** is a deployed contract at
`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` (slug `hiss-vault`). Resolve it
via `GET /api/vaults/hiss-vault` or `readiness.flagshipVault`. Deposit only
when `flagshipVault.deposits.open === true` (a live
`acceptingPublicDeposits()` read). Then compile an intent with
`POST /api/vaults/hiss-vault/deposit-intent`, or call directly: approve USDG
for the vault, then `depositWithAcks(assets, receiver, riskAckHash,
jurisdictionAckHash)` on the vault address.

> ⚠️ **Never SEND a deposit to the `HissUsdGVault` logic address
> `0xb3b6CE5b1C6605dBE897555DdaA191c2AF0A7D10`.** The flagship is an
> EIP-1167 minimal proxy that _delegatecalls_ this logic contract — it is
> the source you audit (source-verified on Blockscout), but depositing into
> it directly reverts. Deposit only into `flagshipVault.address`.

**Verify before you sign (trustless):** `flagshipVault.deposit.ackTexts`
gives the full canonical risk + source-disclosure texts. Compute
`keccak256(bytes(text))` for each and confirm they equal `riskAckHash` /
`jurisdictionAckHash` and the vault's on-chain required hashes before
calling `depositWithAcks`. `factory.isVerifiedVault` being `false` is a
create-time factory flag (the flagship predates the pre-verified-create
path; there is no post-creation setter) — it does NOT mean the source is
unverified. `factory.isVault` is `true` (deployed through the official
`VaultFactory`).

**Read one vault**

| Route                                       | Returns                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/vaults/:slug`                     | Manifest fields, `strategyHash`, fee config, deposit readiness. |
| `GET /api/vaults/:slug/fees`                | Fee phase, fee config, launch fee table, revenue model.         |
| `GET /api/vaults/:slug/source-verification` | Source-verification facts for the vault contracts.              |
| `GET /api/vaults/:slug/receipts`            | Deterministic receipt pointer for the vault.                    |

**Create a vault CANDIDATE** — `POST /api/vaults/create` with a full
`manifest` (or `{name, description, creatorWalletAddress, chainId,
allowedAssetSymbols, lockupSeconds}`) plus the `creatorAck` (VaultCreatorAck
booleans). Returns `{manifest, manifestHash, receipt, persisted,
depositReadiness}`. This only saves a **candidate**. On-chain deployment
happens later from the creator's OWN wallet via `VaultFactory`; saving a
candidate never implies deployment.

**Validate / score** — `POST /api/vaults/:slug/validate` with `{manifest}` →
`{valid, issues, riskScore}`. Risk scoring is structural (fuses, caps,
disclosures), never a return forecast.

**Prepare a USDG deposit intent (gated)** — `POST
/api/vaults/:slug/deposit-intent` with `{manifest, amountUsdg, receiver,
depositorAck}` (VaultDepositorAck booleans). Compiles the on-chain
`depositWithAcks(...)` call + a deterministic receipt. While the deposit
gate is closed it returns `409 LEGAL_READINESS_BLOCKED` (the code name is
historical; there is no jurisdiction eligibility axis). The depositor's own
wallet signs and sends.

**Prepare a withdraw intent** — `POST /api/vaults/:slug/withdraw-intent`
with `{manifest, amountUsdg, receiver}` → intent + receipt. Signing stays
with the wallet.

**Preview a rebalance under fuses**

- `POST /api/vaults/:slug/compile-rebalance-policy` → validates a policy against the mandatory fuses.
- `POST /api/vaults/:slug/simulate-rebalance` → a plan + receipt with `executionAllowed: false`.
- `POST /api/vaults/:slug/rebalance-intent` → `409 LIVE_REBALANCE_BLOCKED` while every asset has `liveRebalanceEnabled=false` (all of them, today). Use simulate for previews.
- `POST /api/vaults/:slug/post-rebalance-audit` → audits reported fills against a plan.

## The two on-chain ack hashes (deposits)

`depositWithAcks` presents keccak256 of the UTF-8 bytes of two canonical
disclosure texts (Solidity `keccak256(bytes(text))`; compute with `cast
keccak` or viem `keccak256(toBytes(text))` — never sha256):

- Risk ack: version `hiss-vault-depositor-risk-ack-v1`.
- Source-disclosure ack: version `hiss-vault-source-disclosure-ack-v1`.

The VaultAck objects (creator, depositor) are a separate consent layer:
every boolean must be LITERALLY `true` with a valid ISO-8601 `timestamp`,
they carry no PII, and their canonical-JSON hash rides on the receipt. A
plain ERC-4626 `deposit()` reverts — depositors must use `depositWithAcks`.

## Gating rules your agent MUST respect

1. **Candidate ≠ deployed ≠ deposit-open.** `GET /api/vaults/readiness` is
   the authority. Deposits open only after deployment, verification, and
   every deposit-readiness check — AND each vault must be marked ready in
   the on-chain `VaultDepositReadinessRegistry` (owner-only). Your agent
   cannot mark a vault ready or flip any owner gate.
2. **planned ≠ funded ≠ claimable.** A manifest hash is data; a deposit
   completes only when the on-chain receipt confirms (a successful tx and a
   vault `Deposit` event). Job status, replies, and memory never count.
3. **A failed fetch proves nothing.** Unknown is not "not deployed" and not
   "live". Re-read the readiness endpoint.
4. **Robinhood Chain only** for vaults. Robinhood MCP is a per-user
   brokerage path — never a pooled vault execution rail.
5. **No credentials, ever.** Every route rejects credential-shaped fields
   (`400 CREDENTIAL_FIELD_REJECTED`) and never echoes them. Pass wallet
   addresses only. 256 KB body cap; 30 requests / 5 min.

## What your agent CANNOT do

- Bypass an owner gate (readiness marking, deploy-approval, any Safe-owned
  action). Deploy a vault for the user. Enable live rebalancing (every
  asset is `liveRebalanceEnabled=false`). Take custody or hold keys. Report
  a deposit/withdrawal complete without the on-chain receipt. Recommend a
  vault — comparisons are factual only; `recommendation` is always `null`.

## Copy rules (guards enforce these)

No guaranteed yield, APY, or returns. HISS never promises safety or a
managed outcome, never claims direct ownership of underlying shares, and
never claims Robinhood or an asset issuer endorses a vault. HISS is not a
broker-dealer, investment adviser, custodian, or order router. Required:
depositors share profits and losses; deposits are not FDIC insured. Not a
performance claim.

## Surfaces

- Vaults hub / marketplace: `https://app.hiss.finance/vaults` · create:
  `https://app.hiss.finance/vaults/create`
- Machine schema: `GET /api/vaults/schema` · authoritative status:
  `GET /api/vaults/readiness`
- Public contract ABIs & addresses: `contracts/abi/`,
  `contracts/deployments/robinhood-chain-mainnet.json` in this repo.
- Related packs: `hiss-stock-tokens`, `hiss-receipts`,
  `hiss-security-boundaries`.

## Example prompts

- "List HISS vaults and tell me which are deposit-open per /api/vaults/readiness."
- "Read the hiss-vault manifest, strategy hash, and fee schedule."
- "Build a vault candidate manifest for a USDG vault on chain 4663 with a full VaultCreatorAck, then validate it."
- "Prepare a 250 USDG deposit intent with a complete VaultDepositorAck — show me the depositWithAcks calldata and ack hashes. Is the gate open?"
- "Simulate a rebalance under these fuses (I know execution stays disabled)."
