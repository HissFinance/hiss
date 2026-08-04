---
name: hiss-vault-agent-kit
description: Let your own AI agent discover, read, create, and help operate HISS USDG Creator Vaults on Robinhood Chain through the existing gated HISS APIs — nothing new on-chain. The CANONICAL new-deposit vault is HISS Vault V2 (queue-routed epoch settlement, 24/7 lanes, in-kind exit); the V1 flagship is LEGACY (closed to new deposits, empty). Covers vault discovery (/api/vaults/*), reading a vault's manifest / strategy hash / fees / source verification, creating a vault CANDIDATE from a validated manifest plus the 9-boolean VaultCreatorAck, preparing V2 queue deposits and withdrawals (in-kind default, queue_usdg mode), the V1-style depositWithAcks ack hashes, and previewing rebalances under fuses. Enforces the truth model — HISS prepares and verifies, never deploys, never custodies, never executes; planned ≠ funded ≠ claimable; a deposit completes only on the on-chain settlement receipt. Use when a user wants their agent to work with HISS vaults.
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
version: 4
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

| Route                            | Returns                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/vaults/schema`         | Machine-readable route list, chain/payment model, fee schedule, deposit-readiness gate, house-vault candidates, source verification.                                                                                                                                                                     |
| `GET /api/vaults`                | `deployedVaults[]` (the live, deposit-open vaults — deposit here) + `vaults[]` (saved candidates, not deployed).                                                                                                                                                                                         |
| `GET /api/vaults/marketplace`    | Marketplace rows; paid placement is disclosed (`paidPlacement`, and placement never implies safety or expected return).                                                                                                                                                                                  |
| `GET /api/vaults/asset-registry` | Source-verified Robinhood Chain assets + `USDG_ASSET_POLICY`. Live rebalancing is disabled on every asset today.                                                                                                                                                                                         |
| `GET /api/vaults/readiness`      | Live chain-health + canonical contract status. Always authoritative for "are contracts live / are deposits open". The canonical new-deposit vault is HISS Vault V2 (queue-routed); the V1 flagship appears as a LEGACY entry (closed to new deposits), with a `doNotUse` implementation-address warning. |

**Deposit into the canonical V2 vault (READ THIS BEFORE ANY DEPOSIT)**

The **canonical new-deposit vault** is **HISS Vault V2** (`HissUsdGVaultV2`) at
**`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`**. A V2 deposit is
**queue-routed**, not a direct ERC-4626 `deposit`:

1. Approve USDG (`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 dec) for the
   **request queue** `0x317d1eEC013a91a316858e80BF782496F231729a`
   (`HissRequestQueue`) — the queue escrows the USDG at enqueue.
2. The user signs an `enqueue` transaction (owner = the signing wallet; carries
   a nonce, an expiry, and an optional minimum-shares-out floor).
3. Shares mint at **epoch settlement** at the epoch clearing rate — **not at
   enqueue**. Nothing is instant by default. A request past its deadline can be
   expired and the escrow refunded.

Receipts distinguish **PREPARATION / SUBMISSION / SETTLEMENT** — only
settlement completes the deposit. How much can settle safely right now is a
**live Price Mesh capacity read — never a fixed promise**; availability is
decided by on-chain market health evidence, never by the calendar. Rebalancing
on the V2 vault is **inactive by policy** (an owner decision, not a fault
state — never render it as degraded or "coming soon"): "AAPL is currently the
only execution-grade Stock Token asset. Initial public operation uses
settlement-driven allocation and preserves the current USDG cash reserve."

> ⚠️ **The V1 flagship `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` is
> LEGACY · EMPTY — closed to new deposits.** Never present it as a deposit
> target; there is no migration flow (nothing to migrate). Also never SEND a
> deposit to the `HissUsdGVault` logic address
> `0xb3b6CE5b1C6605dBE897555DdaA191c2AF0A7D10` — it is the V1 SOURCE you audit
> (source-verified on Blockscout), and depositing into it directly reverts.

**V1-style direct-deposit vaults (ack hashes).** V1-style creator vaults use
`depositWithAcks(assets, receiver, riskAckHash, jurisdictionAckHash)`; the ack
texts are canonical and verifiable — compute `keccak256(bytes(text))` and
confirm they equal the vault's on-chain required hashes before signing. A
plain ERC-4626 `deposit()` reverts on ack-gated vaults. The on-chain
identifiers (`VaultDepositorAck`, `depositWithAcks`,
`hiss-vault-depositor-risk-ack-v1`) are unchanged.

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
receiver}` → intent + receipt. Signing and sending stays with the wallet. On
the canonical V2 vault the default exit is the **in-kind redemption**
(`inKindRedeem` — the always-available, valuation-free pro-rata basket of USDG
cash + held tokens, 24/7); a **queued USDG redemption** (`queue_usdg`) settles
to USDG at the epoch clearing rate instead, with an optional minimum-USDG-out
floor.

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
   the authority. On the canonical V2 vault, queue/keeper/capacity/pause state
   is a live chain read. V1-style direct-deposit vaults open only after
   deployment, verification, and every deposit-readiness check — AND being
   marked ready in the on-chain `VaultDepositReadinessRegistry` (owner-only).
   Your agent cannot mark a vault ready or flip any owner gate.
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

- "List HISS vaults per /api/vaults/readiness — which is the canonical V2 new-deposit vault, and what does its live queue/capacity state say?"
- "Read the hiss-vault manifest, strategy hash, and fee schedule."
- "Build a vault candidate manifest for a USDG vault on chain 4663 with a full VaultCreatorAck, then validate it."
- "Prepare a 250 USDG V2 queue deposit (enqueue) with a minimum-shares-out floor — show me the unsigned plan and explain that shares mint at epoch settlement."
- "Prepare an in-kind redemption of my V2 shares — what basket would I receive?"
- "Simulate a rebalance under these fuses (I know V2 rebalancing is inactive by policy)."
