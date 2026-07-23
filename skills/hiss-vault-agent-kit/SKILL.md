---
name: hiss-vault-agent-kit
description: Let your own AI agent discover, read, create, and help operate HISS USDG Creator Vaults on Robinhood Chain through the existing gated HISS APIs — nothing new on-chain. Covers vault discovery (/api/vaults/*), reading a vault's manifest / strategy hash / fees / source verification, creating a vault CANDIDATE from a validated manifest plus the 9-boolean VaultCreatorAck, preparing a USDG deposit intent with the 14-boolean VaultDepositorAck and the exact depositWithAcks ack hashes, checking the deposit-readiness gate, and previewing rebalances under fuses. Enforces the truth model — HISS prepares and verifies, never deploys, never custodies, never executes; planned ≠ funded ≠ claimable; a deposit completes only on the on-chain receipt. Use when a user wants their agent to work with HISS vaults.
tags:
  [
    vaults,
    usdg,
    robinhood-chain,
    creator-vaults,
    deposits,
    manifest,
    receipts,
    agent-kit,
    cross-rail,
    price-mesh,
  ]
version: 3
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Vault Agent Kit (USDG Creator Vaults)

## Purpose

This pack lets a user's own AI agent work with HISS USDG Creator Vaults on
Robinhood Chain (mainnet 4663, testnet 46630) through the HISS APIs that
already exist. HISS is compilation and verification software: it prepares
manifests, deposit intents, and receipts, and it verifies on-chain state.
It never deploys a vault for you, never custodies funds, never holds keys,
and never sends a transaction. Every route returns `notInvestmentAdvice:
true` and `liveOrderSent: false`, and every response passes the
execution-claim guard and the vault copy guard.

Base asset: USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals).
Base is never a vault chain — a manifest with any other `chainId` returns
`400 VAULT_CHAIN_INVALID`.

## What your agent CAN do (all real endpoints, base `https://app.hiss.finance`)

**Discover**

| Route                            | Returns                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/vaults/schema`         | Machine-readable route list, chain/payment model, fee schedule, deposit-readiness gate, house-vault candidates, source verification.                                                                                                                                                        |
| `GET /api/vaults`                | `deployedVaults[]` (the live, deposit-open vaults — deposit here) + `vaults[]` (saved candidates, not deployed).                                                                                                                                                                            |
| `GET /api/vaults/marketplace`    | Marketplace rows; paid placement is disclosed (`paidPlacement`, and placement never implies safety or expected return).                                                                                                                                                                     |
| `GET /api/vaults/asset-registry` | Source-verified Robinhood Chain assets + `USDG_ASSET_POLICY`. Live rebalancing is disabled on every asset today.                                                                                                                                                                            |
| `GET /api/vaults/readiness`      | Live chain-health + canonical contract status, PLUS `flagshipVault` — the live deposit-open flagship with its DEPLOYED address, live `deposits.open`, `deposit` params, and a `doNotUse` implementation-address warning. Always authoritative for "are contracts live / are deposits open". |

**Deposit into the live flagship vault (READ THIS BEFORE ANY DEPOSIT)**

The flagship **HISS Vault** is a deployed contract at **`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`** (slug `hiss-vault`). Resolve it via `GET /api/vaults/hiss-vault` or `readiness.flagshipVault`. Deposit only when `flagshipVault.deposits.open === true` (a live `acceptingPublicDeposits()` read). Then either compile an intent with `POST /api/vaults/hiss-vault/deposit-intent`, or call directly: approve USDG (`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 dec) for the vault, then `depositWithAcks(assets, receiver, riskAckHash, jurisdictionAckHash)` on the vault address, using the two ack hashes in `flagshipVault.deposit` / below.

> ⚠️ **Never SEND a deposit to the `HissUsdGVault` address `0xb3b6CE5b1C6605dBE897555DdaA191c2AF0A7D10`.** The flagship is an EIP-1167 minimal proxy that _delegatecalls_ this logic contract — so it is the SOURCE you audit (it is source-verified on Blockscout, `sourceVerification.implementationExplorerUrl`), but depositing into it directly reverts. Deposit only into `flagshipVault.address`.

**Verify before you sign (trustless):** `flagshipVault.deposit.ackTexts` gives the full canonical risk + source-disclosure texts. Compute `keccak256(bytes(text))` for each and confirm they equal `riskAckHash` / `jurisdictionAckHash` and the vault's on-chain required hashes before calling `depositWithAcks`. `flagshipVault.sourceVerification` shows the flagship is a clone of the verified `HissUsdGVault` logic (audit `depositWithAcks` there). `flagshipVault.factory.isVerifiedVault` is `false` — that is a create-time factory flag (the flagship predates the owner's pre-verified-create path, and there is no post-creation setter); it does NOT mean the source is unverified. `factory.isVault` is `true` (deployed through the official VaultFactory).

**Read one vault**

| Route                                       | Returns                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `GET /api/vaults/:slug`                     | The stored vault: manifest fields, `strategyHash`, fee config, deposit readiness. |
| `GET /api/vaults/:slug/fees`                | Fee phase, fee config, launch fee table, revenue model.                           |
| `GET /api/vaults/:slug/source-verification` | Source-verification facts for the vault contracts.                                |
| `GET /api/vaults/:slug/receipts`            | Deterministic receipt pointer for the vault.                                      |

**Create a vault CANDIDATE**

`POST /api/vaults/create` with either a full `manifest` or
`{name, description, creatorWalletAddress, chainId, allowedAssetSymbols,
lockupSeconds}` — plus a `creatorAck` (the 9-boolean `VaultCreatorAck`).
Returns `{manifest, manifestHash, receipt, persisted, depositReadiness}`.
This only saves a **candidate** — a `strategyDescriptionHash`-anchored
record. On-chain deployment happens later from the creator's OWN wallet via
`VaultFactory`; a public creation fee applies only when the vault is
published on-chain. Saving a candidate never implies deployment.

**Validate / score before creating**

`POST /api/vaults/:slug/validate` with `{manifest}` → `{valid, issues,
riskScore}`. Risk scoring is structural (fuses, caps, disclosures), never a
return forecast.

**Prepare a USDG deposit intent (gated)**

`POST /api/vaults/:slug/deposit-intent` with `{manifest, amountUsdg,
receiver, depositorAck}` (the 14-boolean `VaultDepositorAck`). It compiles
the intent for the on-chain call
`depositWithAcks(assets, receiver, riskAckHash, jurisdictionAckHash)` and a
deterministic receipt. While the deposit gate is closed it returns
`409 LEGAL_READINESS_BLOCKED` (the code name is
historical; there is no jurisdiction eligibility axis). The depositor's own
wallet signs and sends the transaction — HISS does not.

**Prepare a withdraw intent**

`POST /api/vaults/:slug/withdraw-intent` with `{manifest, amountUsdg,
receiver}` → intent + receipt. Signing and sending stays with the wallet.

**Preview a rebalance under fuses**

- `POST /api/vaults/:slug/compile-rebalance-policy` → validates a policy against the mandatory fuses.
- `POST /api/vaults/:slug/simulate-rebalance` → a plan + receipt with `executionAllowed: false`.
- `POST /api/vaults/:slug/rebalance-intent` → `409 LIVE_REBALANCE_BLOCKED` while every asset has `liveRebalanceEnabled=false` (all of them, today). Use simulate for previews.
- `POST /api/vaults/:slug/post-rebalance-audit` → audits reported fills against a plan.

**Deposit rails (cross-reference `hiss-bankrbot-vault-deposit`)**

`GET /api/vaults/:slug/deposit-link` returns a ready-to-use app deposit
link; `POST /api/vaults/:slug/deposit-bankrbot-intent` builds a Bankr
command pack (`hissExecutesDeposit: false`). A deposit is complete only
after the on-chain receipt confirms.

## Cross-rail funding is a manual handoff — NEVER an auto-deposit

If a user wants to fund a vault deposit with value that currently sits on their
Robinhood brokerage rail, that is a **cross-rail handoff**, not a HISS action:

- There is no funding, transfer, or bridge tool in the Robinhood MCP
  (verified-absent). HISS never moves brokerage money and never "auto-deposits"
  arriving funds. Never say "auto-deposit", "auto-transfer", "automatic bridge",
  or a "bridge ETA". Use `hiss-cross-rail-handoff` and its eight states.
- The sequence is: HISS PREPARES the steps → the USER performs the
  brokerage-side movement in their own Robinhood app (MANUAL_ACTION_REQUIRED) →
  once USDG has ARRIVED on chain, the vault deposit is a **separate,
  user-signed chain transaction** (`depositWithAcks`) with its own wallet
  authorization and its own on-chain receipt. Detection ends at RECONCILED; the
  deposit is never chained to the arrival automatically.
- Arrival detection is correlation, not causation: an arriving amount matching
  a prepared handoff is evidence, not proof the withdrawal caused it. Every
  reconciliation carries its causality note.

The **wallet signature for a vault deposit is separate** from any grant, ack,
or brokerage authorization. The depositor's own wallet signs and sends
`depositWithAcks`; HISS compiles the intent and verifies, but signs nothing.

## Price-mesh and vault valuation (reference vs executable)

Vault NAV and asset prices shown by these routes are **reference** valuations
under the oracle-freshness policy — not an executable quote and not a promise of
a fill or a redemption value. Use `hiss-price-mesh` to keep a reference price
separate from what a specific size could actually transact at. A tokenized
stock/ETF held by a vault is economic exposure, not direct share ownership, and
its chain price is not a parity to any brokerage quote. A degraded/stale oracle
read shows the last verified NAV, labelled — never a fresh number.

## The two on-chain ack hashes (deposits)

`depositWithAcks` presents keccak256 of the UTF-8 bytes of two canonical
disclosure texts (Solidity `keccak256(bytes(text))`; compute with `cast
keccak` or viem `keccak256(toBytes(text))` — never sha256):

- Risk ack: version `hiss-vault-depositor-risk-ack-v1`.
- Source-disclosure ack: version `hiss-vault-source-disclosure-ack-v1`.

The two `VaultAck` objects (9-boolean creator, 14-boolean depositor) are a
separate consent layer: every boolean must be LITERALLY `true` with a valid
ISO-8601 `timestamp`, they carry no PII, and their canonical-JSON hash rides
on the receipt. A plain ERC-4626 `deposit()` reverts — depositors must use
`depositWithAcks`.

## Truth and gating rules your agent MUST respect

1. **HISS prepares and verifies; it never executes.** No route sends a
   transaction. Deploying, depositing, withdrawing, and rebalancing are all
   signed by the relevant wallet, never by HISS.
2. **Candidate ≠ deployed ≠ deposit-open.** `GET /api/vaults/readiness` is
   the authority. Deposits open only after deployment, verification, and
   every deposit-readiness check — AND each vault must be marked ready in the
   on-chain `VaultDepositReadinessRegistry` (owner-only). Your agent cannot
   mark a vault ready or flip any owner gate.
3. **planned ≠ funded ≠ claimable.** A manifest hash is data; a deposit
   completes only when the on-chain receipt confirms (a successful tx and a
   vault `Deposit` event). Job status, replies, and memory never count.
4. **A failed fetch proves nothing.** Unknown/unavailable is not
   "not deployed" and not "live". Re-read the readiness endpoint.
5. **Robinhood Chain only.** Base is never a vault chain; it appears only as
   an x402 payment settlement rail. Robinhood MCP is a per-user brokerage
   path — never a pooled vault execution rail.
6. **Tokenized stocks are economic exposure only**, never direct ownership
   of the underlying shares; issuer-side restrictions are per-asset
   disclosures the depositor acknowledges, never a HISS eligibility gate.
7. **No credentials, ever.** Every route rejects credential-shaped fields
   (`400 CREDENTIAL_FIELD_REJECTED`) and never echoes them. Pass wallet
   addresses only. 256 KB body cap; 30 requests / 5 min.

## What your agent CANNOT do (do not imply otherwise)

- Bypass an owner gate — deposit-readiness marking, deploy-approval flags,
  or any Safe-owned action. These are owner-only; the pack cannot flip them.
- Deploy a vault for the user, or claim a candidate is deployed or
  deposit-open without proof from `GET /api/vaults/readiness`.
- Enable live rebalancing (every asset is `liveRebalanceEnabled=false`).
- Take custody, hold keys, or accept a private key / seed phrase / API key.
- Report a deposit, withdrawal, or trade as complete without the on-chain
  receipt.
- Recommend a vault. Comparisons are factual only — `recommendation` is
  always `null`.

## Copy rules (the guards enforce these)

No guaranteed yield, APY, or returns. HISS never promises safety or a
managed outcome, never claims direct ownership of the underlying shares, and
never claims that Robinhood or an asset issuer endorses a vault. HISS is not
a broker-dealer, investment adviser, custodian, or order router. Required
disclosure: depositors share profits and losses, and deposits are not FDIC
insured. Not a performance claim.

Reward-method terminology: under the current `HISS_REWARD_METHOD_V2`
50/15/15/10/10 reward split, vault depositors are the "vault contributors"
cohort (the V2 rename of the former "depositor" leg; the same 15% leg,
methodology unchanged). This is terminology only — the on-chain deposit
identifiers are unchanged: keep `VaultDepositorAck`, `depositWithAcks`, and
the `hiss-vault-depositor-risk-ack-v1` ack version verbatim. Vault rewards
are separate from deposits: V2's retroactive catch-up is executed on-chain,
but monthly epochs are pending (nothing vesting or claimable), so a deposit
never implies a reward. See the `hiss-reward-split` pack.

## Surfaces

- Vaults hub: https://app.hiss.finance/vaults · create wizard:
  https://app.hiss.finance/vaults/create · vault discovery lives on the hub
  itself (the old `/app/vaults/marketplace` URL redirects to the hub)
- Machine schema: `GET /api/vaults/schema` · authoritative status:
  `GET /api/vaults/readiness` · agent rails: `GET /api/agents/schema`
- MCP tools (local `hiss-mcp` stdio server): `hiss_get_vaults` · `hiss_get_vault` ·
  `hiss_get_vault_holdings` · `hiss_get_vault_performance` ·
  `hiss_get_supported_assets` · `hiss_get_fee_schedule` ·
  `hiss_create_vault_candidate` · `hiss_validate_vault_candidate` ·
  `hiss_prepare_vault_deposit` · `hiss_prepare_vault_withdrawal` ·
  `hiss_verify_receipt`
- HTTP-only helpers: `POST /api/tools/receipt` (vault receipt); rebalance
  preview, structural vault-risk scoring, and no-recommendation vault
  comparison are preview/audit routes (no execution rail)
- Docs: https://docs.hiss.finance/usdg-vaults ·
  https://docs.hiss.finance/vault-depositor-risks ·
  https://docs.hiss.finance/vault-deposit-readiness ·
  https://docs.hiss.finance/vault-contract-status
- Related packs: `hiss-bankrbot-vault-deposit` (deposit rails),
  `hiss-bankr-vault-rebalance` (operator rebalance), `hiss-receipts`,
  `hiss-cross-rail-handoff` (manual cross-rail funding), `hiss-price-mesh`
  (reference vs executable valuation).

## Example prompts

- "List HISS vaults and tell me which are deposit-open per /api/vaults/readiness."
- "Read the hiss-vault manifest, strategy hash, and fee schedule."
- "Build a vault candidate manifest for a USDG vault on chain 4663 with a full VaultCreatorAck, then validate it."
- "Prepare a 250 USDG deposit intent into this vault with a complete VaultDepositorAck — show me the depositWithAcks calldata and ack hashes. Is the gate open?"
- "Simulate a rebalance under these fuses (I know execution stays disabled)."
