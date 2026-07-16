---
name: hiss-rewards
description: Explain and verify the HISS 50/30/10/10 reward split — 50% of verified HISS-token trading fees to xHISS stakers, 30% to depositor vesting, 10% to provider rewards, 10% to the 2-of-3 Treasury Safe, with 100% of claimed WETH to the Safe and creator vesting excluded. Enforces the source-classification rules (high-confidence chain-verified fees only, fail-closed) and the planned ≠ funded ≠ claimable state chain. Use when a user or agent asks where HISS fees go, how a split plan works, or whether a distribution actually happened.
tags: [reward-split, fees, hiss-token, xhiss, treasury-safe, robinhood-chain]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Rewards (50/30/10/10 Split of Verified HISS Trading Fees)

## Purpose

The split policy (`hiss-reward-split-v1`) turns one input — the
`eligibleHissTradingFeeAmount` of a HIGH-confidence, chain-verified
fee-claim classification — into four legs. The policy constants are
literal-typed; the split cannot drift silently.

## The legs (basis points of the eligible HISS)

- `5000` — xHISS stakers, delivered ONLY via `injectRewards` on the
  deployed xHISS vault (24-hour linear drip; reverts with no stakers).
- `3000` — depositor vesting distributor.
- `1000` — provider rewards distributor.
- `1000` — HISS Treasury Safe
  (`0xF100Fc28dd1721C698046Dbd60408c523b69e36c`, 2-of-3), absorbs
  floor-division dust so the four legs sum EXACTLY to the input.

## Source classification rules (fail-closed, twice)

1. Only deltas classified `hiss_trading_fee` at HIGH confidence are
   eligible. Creator vesting, WETH, manual transfers, pre-existing
   balances, and unclassified deltas are excluded upstream AND re-rejected
   inside the split function (reconciliation of eligible deltas against the
   total).
2. Claimed WETH is never split: policy is 100% of claimed WETH to the
   Treasury Safe.
3. Undeployed recipients are `null` in split plans (both distributors are
   not deployed today) — nothing can move against `null`. Do not describe
   depositor vesting or provider distributors as live, funded, or claimable.
4. Claim imports are chain-verified (receipt status + decoded ERC-20
   Transfer logs); dashboard amounts are never upgraded to on-chain facts.

## Planned ≠ funded ≠ claimable (never skip a state)

- **Planned** — a deterministic split plan with a keccak `planHash`. Data
  only; nothing moved.
- **Funded** — owner-gated (approval env flag by NAME + exact
  `--confirm-plan-hash`) and every transfer verified on-chain.
- **Claimable/received** — value reaches xHISS holders only through an
  on-chain injection to the deployed vault, and reaches vesting/provider
  recipients only through their own distributors.
- Never report a later state from an earlier one, and never report any
  state without its artifact or chain proof.

## Copy rules (hard)

- Rewards are discretionary fee routing under a disclosed policy — never
  yield, APY, dividends, passive income, or an income product.
- Always: "Not a performance claim." With history: "Historical fee
  distributions are not forecasts."
- The scope sentence: "This split applies only to verified HISS-token
  trading-fee rewards. WETH fees, creator vesting, unclassified HISS, and
  treasury balances are separate."

## Treasury Safe (the treasury leg's owner)

- Safe `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` — 2-of-3 Safe v1.4.1
  proxy on chain 4663, verified by on-chain reads (`getThreshold() == 2`,
  3 owners, no modules, no guard). It receives the 10% treasury leg and
  100% of claimed WETH, and owns the xHISS vault (`setInjector`, `pause`).
- It CANNOT pause exits, rescue or move staked HISS, mint xHISS, or change
  the immutable cooldown/redeem/drip constants. Multisig is risk reduction,
  not elimination — never call anything "risk-free".
- Never fabricate Safe state: threshold, owners, and balances come from
  on-chain reads only; a failed read is "unknown".

## Surfaces

- Docs: `/docs/reward-split` · `/docs/hiss-reward-flywheel` ·
  `/docs/hiss-fee-routing` · `/docs/provider-rewards`
- MCP tools (see `hiss-mcp`): `hiss_get_hiss_reward_split` ·
  `hiss_get_reward_injection_history` · `hiss_get_hiss_safe_status`
- Related packs: `hiss-staking` (the staker leg surface),
  `hiss-security-boundaries`.
