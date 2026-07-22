---
name: hiss-staking
description: Guide users and agents through xHISS staking on Robinhood Chain — stake $HISS for xHISS, exact-amount approvals, previewStake, the 72-hour cooldown with a 2-day redeem window, and fee-funded injections that drip over 24 hours. Enforces the truth state (the vault is deployed and Safe-owned; no rewards funded yet) and the no-overclaim copy rules (never yield, APY, dividends, passive income, or performance claims). Use when a user or agent asks how to stake HISS, what xHISS is, how to unstake, or whether staking is live.
tags: [xhiss, staking, hiss-token, robinhood-chain, cooldown, reward-injections]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_staking_status
  - hiss_prepare_hiss_stake
  - hiss_prepare_xhiss_cooldown
  - hiss_prepare_xhiss_redeem
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# xHISS Staking (Stake $HISS, Receive xHISS)

## Purpose

xHISS is the share token of the `XHissVault` single-asset staking vault over
$HISS (`0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3`, 18 decimals, Robinhood
Chain 4663). Staking mints xHISS at the current rate; approved injectors add
verified HISS trading fees that drip into the share value over 24 hours.
There is no reward token, no emissions, no per-user claims. Not a
performance claim.

Vault address: `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be`
(`contracts/deployments/robinhood-chain-mainnet.json`; interface in
`contracts/src/interfaces/IXHissVault.sol`).

## Truth state (check FIRST, every time)

- The vault is **deployed** on chain 4663 at
  `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be`, owned by the 2-of-3 HISS
  Treasury Safe. Confirm live via `GET /api/stake/status` and on-chain
  reads (`owner()`, `totalHissStaked()`); the committed deployment JSON is
  the address of record.
- The reward injector is authorized, but **no rewards are funded**: planned
  ≠ funded ≠ claimable. Never show funded or claimable rewards without an
  on-chain receipt.
- A failed status fetch proves NOTHING: not live, not gone. Fall back to
  the last verified state and say so.
- Review wording, verbatim: "No known unresolved Critical or High findings
  after internal launch review." Internal review — never claim an external
  audit.

## The workflow

1. **Prepare** — the user's own wallet holds $HISS on chain 4663. HISS
   never takes custody; connecting a wallet is not a Robinhood connection.
2. **Approve** — ERC-20 approve of the vault for the EXACT amount. Never
   request unlimited approvals.
3. **Stake** — `stake(hissAmount)` mints xHISS; show
   `previewStake(hissAmount)` first. The rate starts 1:1 and moves only
   through injections. Never render a zero-amount stake action.
4. **Cooldown** — `startCooldown(xShares)` (partial allowed) escrows the
   shares and starts the 72-hour (259200 s) timer; adding shares restarts
   the timer for the whole escrow; `cancelCooldown()` returns them anytime.
   `cooldownOf(staker)` → (shares, readyAt, windowEndsAt).
5. **Redeem** — inside the 2-day (172800 s) window after `readyAt`,
   `redeem(xShares, receiver)` burns cooled shares for HISS at the
   then-current rate. Missed window → `restartCooldown()`; the escrowed
   xHISS is never lost. Exits are NOT pausable; staking/injections are
   (Safe-controlled).

## Copy rules (hard)

1. Never: guaranteed yield/APY, projected APY, passive income, dividends,
   holder-reward or income-product framing, risk-free, "externally
   audited".
2. Approved framing, verbatim where possible: "Stake HISS, receive xHISS.
   Fee-funded HISS injections increase the HISS-per-xHISS share value over
   time." Always carry "Not a performance claim."; with history:
   "Historical fee distributions are not forecasts."
3. If no verified fees arrive, nothing is injected and the rate does not
   increase — say so when asked.
4. Injection history comes from `GET /api/stake/reward-injections`
   (verified rows only); an unreachable endpoint is "unknown", never "no
   injections happened".
5. The 50% staker leg is part of HISS Reward Method V2 (50/15/15/10/10),
   which also includes a 10% economic burn to the canonical dead address
   `0x000000000000000000000000000000000000dEaD`. The burn metric is the
   dead-address HISS balance (a live `HISS.balanceOf(0x…dEaD)` read) —
   `HISS.totalSupply` is NOT reduced. Never present the burn as a reduction
   of total supply. See `hiss-rewards`.

## Surfaces

- UI: `https://app.hiss.finance/stake` (the legacy
  `https://www.hiss.finance/app/stake` 308-redirects here)
- Status: `GET /api/stake/status` · history: `GET /api/stake/reward-injections`
- MCP tools (see `hiss-mcp`): `hiss_get_staking_status` ·
  `hiss_prepare_hiss_stake` · `hiss_prepare_xhiss_cooldown` ·
  `hiss_prepare_xhiss_redeem`. (A staker's specific position and reward-injection
  history are HTTP-only.)
- Docs: `https://docs.hiss.finance/hiss-stake` ·
  `https://docs.hiss.finance/xhiss` · `https://docs.hiss.finance/staking-risks`
- Related packs: `hiss-rewards` (HISS Reward Method V2, the 50/15/15/10/10
  funding policy), `hiss-security-boundaries` (the 2-of-3 Safe powers).
