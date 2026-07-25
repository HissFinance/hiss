# Execution orchestration — the four user-owned models

HISS prepares and coordinates; the USER's own authority signs and submits. Nothing
in this skill or on the hosted MCP holds a key, signs, or submits. This reference
details how the skill discovers an authority, gates signing, and hands off to each
of the four execution models.

## Authority discovery

Read the capability advert before offering any execution step:

- `hissMcpPrepares: true` — invariant. The hosted MCP (`mcp.hiss.finance`, 33
  tools) is read + prepare only. There is no hosted execute tool and there never
  will be one.
- `browserWallet` / `safe` / `bankrSession` / `localRuntime` — each is
  `available` / `unavailable` / `unknown`. Only `available` is a usable target.
- `highestEnabledStage` — the owner-gated activation stage. Signing stages default
  OFF; the primary state is LIVE_READ / LIVE_SHADOW / LIVE_PREPARE.
- `killSwitchEngaged` — when true, the whole signing ladder is forced OFF;
  read/shadow/prepare survive.

If no surface is `available`, return `EXECUTION_AUTHORITY_REQUIRED` and continue in
read / explain / shadow / prepare only.

## The live-signing gate (fail-closed, §10)

A signing offer may be shown ONLY when the data mode is genuinely LIVE AND every
precondition is current and true: canonical token, verified pool, verified
position manager, fresh reference, fresh TWAP, current multiplier, no unresolved
corporate action, current liveness, current USDG peg, exact-size probe covering
the requested size, dynamic single-venue capacity, per-user eligibility, and a
current simulation of the exact calldata. DEMO/SHADOW can never unlock signing.
Any missing/stale/UNKNOWN input keeps signing locked — the correct behavior.

## Model 1 — Browser wallet

1. Confirm an injected EIP-1193 provider / wagmi connector on chain 4663 (switch
   chains if needed; never sign off-chain-4663).
2. The user signs each `SplTxHandoff` in order: exact approve → operation call(s)
   → revoke-to-zero. Each is decodable and carries `liveTransactionSent: false`
   until the wallet actually submits.
3. Verify each on-chain receipt before advancing.

## Model 2 — Safe (multisig)

1. HISS prepares a Safe-importable batch of unsigned `SplTxHandoff`s (no
   signature, no key).
2. Owners import, collect the threshold, and execute in the Safe UI/app. A
   proposal or a queued tx is NOT settled — only the executed on-chain tx is.
3. Reconcile: owner of the position NFT == the Safe; no residual allowance.

## Model 3 — Authenticated Bankr user session

1. Requires the user's OWN Bankr session, authenticated AND location-verified. A
   session that fails either is ineligible (`LOCATION_VERIFICATION_REQUIRED`).
2. HISS never uses its own Bankr credential for a user's LP position. Body-size
   limits apply to large calldata — split where needed.
3. `job_completed_unconfirmed` is not settlement; wait for `onchain_confirmed`.

## Model 4 — Local runtime

1. The user runs a local signer/keeper against the prepared package; keys never
   leave the user's machine and HISS hosts nothing.
2. Same ordered handoff discipline; same deterministic receipt verification.

## Close discipline (all models)

A close is ORDERED, never a single tx: decreaseLiquidity(all) → collect(all) →
burn. The burn is hard-guarded — re-read `positions(tokenId)` and require
`liquidity == 0 AND tokensOwed0 == 0 AND tokensOwed1 == 0` before signing it. If
the position cannot be read, refuse to plan the close and never emit a burn.
