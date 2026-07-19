---
name: hiss-rewards
description: Explain and verify HISS Reward Method V2 — the 50/15/15/10/10 split of verified HISS-token trading fees — 50% to xHISS stakers, 15% to Vault Providers, 15% to Vault Contributors, 10% to the 2-of-3 Treasury Safe, and 10% economic burn to the canonical dead address, with 100% of claimed WETH to the Safe and creator vesting excluded. Enforces the source-classification rules (high-confidence chain-verified fees only, fail-closed) and the planned ≠ funded ≠ claimable state chain. Use when a user or agent asks where HISS fees go, how a split plan works, what the economic burn is, or whether a distribution actually happened.
tags: [reward-split, fees, hiss-token, xhiss, treasury-safe, robinhood-chain]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_reward_status
  - hiss_get_protocol_status
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Rewards (HISS Reward Method V2 — 50/15/15/10/10 Split of Verified HISS Trading Fees)

## Purpose

HISS Reward Method V2 (`HISS_REWARD_METHOD_V2`, split version
`hiss-reward-split-v2`) turns one input — the
`eligibleHissTradingFeeAmount` of a HIGH-confidence, chain-verified
fee-claim classification — into FIVE legs. The policy constants are
literal-typed; the split cannot drift silently.

V2 is the CURRENT split. V1 (`hiss-reward-split-v1`, 50/30/10/10, four
legs, no burn) is HISTORICAL — keep it only where clearly labelled as
superseded, never as the live split.

## The legs (basis points of the eligible HISS)

- `5000` (`XHISS_STAKER_BPS`) — xHISS stakers, delivered ONLY via
  `injectRewards` on the deployed xHISS vault (24-hour linear drip;
  reverts with no stakers).
- `1500` (`VAULT_PROVIDER_BPS`) — **Vault Providers** → vault-provider
  rewards distributor (facts-only quality score, 90-day vest).
- `1500` (`VAULT_CONTRIBUTOR_BPS`) — **Vault Contributors** →
  vault-contributor vesting distributor (share-seconds, 30-day vest).
- `1000` (`TREASURY_BPS`) — HISS Treasury Safe
  (`0xF100Fc28dd1721C698046Dbd60408c523b69e36c`, 2-of-3), absorbs
  floor-division dust so the five legs sum EXACTLY to the input.
- `1000` (`BURN_BPS`) — **economic burn** → the canonical dead address
  `HISS_BURN_ADDRESS` = `0x000000000000000000000000000000000000dEaD`.

Five legs sum to exactly `10000` bps / 100%.

## Vault Contributors (terminology)

- **"Vault Contributors" is the current name for the former depositor
  reward cohort.** The methodology is UNCHANGED: pro-rata by
  **share-seconds** (Σ shares × seconds held),
  `VAULT_CONTRIBUTOR_VEST_SECONDS` = 2,592,000 s (30-day linear vest), no
  PnL / APY / performance inputs. `allocateVaultContributorRewards` in
  `@hiss-finance/core`; CLI `hiss rewards contributor <address>`; client
  `getVaultContributorReward`.
- **"Vault Providers"** = the provider reward cohort (facts-only quality
  score, 25% dominance cap, `PROVIDER_VEST_SECONDS` = 7,776,000 s / 90-day
  vest).
- People who deposit into a vault are still "depositors" in the
  deposit-action sense (they share profits and losses). Only the
  reward-cohort name changed to Vault Contributors. On-chain contract
  artifacts keep their deployed names (e.g. the
  `VaultDepositorRewardsDistributor` ABI) — the label change is in the
  reward accounting, not the contracts.

## Economic burn (critical wording)

- The burn leg is an **ECONOMIC burn**: HISS is transferred to the
  canonical dead address `0x000000000000000000000000000000000000dEaD`. It
  leaves circulation (nobody holds the key) but **`HISS.totalSupply` is
  NOT reduced** — this is not an ERC-20 supply burn.
- **Burn metric:** the "amount burned" is the **dead-address HISS
  balance** — a live chain read of `HISS.balanceOf(0x…dEaD)`, described as
  economic burn, never as a reduction of totalSupply.
- **Retroactive migration EXECUTED:** cumulative economic burn to the
  dead address is **219,158,426,524,474,729,694,326,935 base units**
  (~**219.16M HISS**). `HISS.totalSupply` is unchanged by this
  dead-address transfer.
- **Deployer-exclusion + owner-replenishment migration-pair:** the
  retroactive migration is modelled as a pair — deployer-held / excluded
  HISS is excluded from reward accounting, and an owner-authorized
  replenishment funds the corresponding economic-burn transfer. The pair
  nets out so the accounting stays exact.

## Source classification rules (fail-closed, twice)

1. Only deltas classified `hiss_trading_fee` at HIGH confidence are
   eligible. Creator vesting, WETH, manual transfers, pre-existing
   balances, and unclassified deltas are excluded upstream AND re-rejected
   inside the split function (reconciliation of eligible deltas against the
   total).
2. Claimed WETH is never split: policy is 100% of claimed WETH to the
   Treasury Safe.
3. Undeployed recipients are `null` in split plans (the Vault Provider
   and Vault Contributor distributors are not deployed today) — nothing
   can move against `null`. Do not describe Vault Contributor vesting or
   Vault Provider distributors as live, funded, or claimable.
4. Claim imports are chain-verified (receipt status + decoded ERC-20
   Transfer logs); dashboard amounts are never upgraded to on-chain facts.

## Planned ≠ funded ≠ claimable (never skip a state)

- **Planned** — a deterministic split plan with a keccak `planHash`. Data
  only; nothing moved.
- **Funded** — monthly Safe epoch funding requires the 2-of-3 Treasury
  Safe (approval env flag by NAME + exact `--confirm-plan-hash`), after a
  7-day challenge window, with every transfer verified on-chain.
- **Claimable/received** — value reaches xHISS holders only through an
  on-chain injection to the deployed vault, and reaches Vault Contributor
  / Vault Provider recipients only through their own distributors.
- Never report a later state from an earlier one, and never report any
  state without its artifact or chain proof. planned ≠ funded ≠ vesting ≠
  claimable.

## Copy rules (hard)

- Rewards are discretionary fee routing under a disclosed policy — never
  yield, APY, dividends, passive income, or an income product. No
  guaranteed return.
- Always: "Not a performance claim." With history: "Historical fee
  distributions are not forecasts."
- The scope sentence: "This split applies only to verified HISS-token
  trading-fee rewards. WETH fees, creator vesting, unclassified HISS, and
  treasury balances are separate."
- The economic burn is described as an economic burn (dead-address
  balance) — never as a reduction of `HISS.totalSupply`.

## Free website / first-party app policy

- The HISS **website and first-party app tools are FREE** — no
  subscriptions, no credits, no paywalls. The **packages are open-source**
  (Apache-2.0).
- Users **retain signing control**: HISS prepares and verifies; the user's
  own wallet or Safe signs and submits. HISS never signs, never submits,
  never takes custody.
- Normal network gas and contract-enforced protocol fees may still apply
  (these are on-chain, not HISS subscriptions).
- `x402` services are separate machine-to-machine (agent) rails where
  configured — distinct from the free first-party website/app. Never claim
  "Robinhood supports x402".

## Treasury Safe (the treasury leg's owner)

- Safe `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` — 2-of-3 Safe v1.4.1
  proxy on chain 4663, verified by on-chain reads (`getThreshold() == 2`,
  3 owners, no modules, no guard). It receives the 10% treasury leg and
  100% of claimed WETH, and owns the xHISS vault (`setInjector`, `pause`).
- It CANNOT pause exits, rescue or move staked HISS, mint xHISS, or change
  the immutable cooldown/redeem/drip constants, and it cannot recover HISS
  sent to the dead address. Multisig is risk reduction, not elimination —
  never call anything "risk-free".
- Never fabricate Safe state: threshold, owners, and balances come from
  on-chain reads only; a failed read is "unknown".

## Surfaces

- Docs: `/docs/reward-split` · `/docs/hiss-reward-flywheel` ·
  `/docs/hiss-fee-routing` · `/docs/provider-rewards`
- MCP tools (see `hiss-mcp`): `hiss_get_reward_status` ·
  `hiss_get_protocol_status` (includes the Treasury Safe). Reward-injection
  history is HTTP-only.
- Related packs: `hiss-staking` (the 50% staker leg surface),
  `hiss-security-boundaries`.
