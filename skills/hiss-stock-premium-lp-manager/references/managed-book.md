# Managed book vs. self-signed

Two position kinds exist on-surface, kept strictly distinct. HISS signs neither
and custodies neither.

## Managed book (`HissLpManagerV1`)

- The **Positions** tab (`/stock-premium-lp/positions`) renders the LIVE managed
  book — LP positions the `HissLpManagerV1` contract holds under an enrollment.
  The beneficiary is chain-verifiable; in/out-of-range badges come from a live
  `slot0` read.
- Contract: deployed + Blockscout-verified at
  `0xBE5989a38953D8148B74d45eE6DEB127a32567E0` on Robinhood Chain (4663). Its
  `owner()` and `treasury()` are both the HISS Treasury Safe (2-of-3)
  `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`. It **LAUNCHED PAUSED**
  (immutable initial state); the owner-gated Safe unpause has since EXECUTED
  on-chain (Safe nonce 81, tx
  `0x6a93479c8ae6037bb92c237fb85ee67cb5d50a9a096ac0fcbc697126b65941cb`).
  `paused()` / `feeBps()` / `owner()` / `treasury()` are ALWAYS live chain
  reads — never copied from here; a failed read renders unknown.
- **Fee:** `HISS_LP_MANAGEMENT_FEE_V1` = 500 bps (5%) of **realized LP fees
  only** (never principal, never P&L, never gross notional); the remaining 95% is
  the user's. `MAX_FEE_BPS` is an immutable 500. The fee is charged **only when a
  managed action actually collects realized fees** — nothing is charged on
  principal, on an open position, or on unrealized value. 100% of the fee routes
  to the Treasury Safe; verified Treasury receipts are shown only from reconciled
  on-chain evidence.
- **Paused = inert.** While paused, no positions are enrollable and nothing is
  charged. The unpause is a separate owner-gated action (executed — see the
  activation tx above), and unpaused alone opens nothing: enrollment and every
  managed action stay owner/beneficiary-gated. Never describe the managed path
  as funded or claimable, and never assert the current pause state without a
  fresh read.

## Self-signed positions

- Built in the **Build** tab: preview against the canonical `@hiss/core` engine,
  then prepare a typed UNSIGNED package the user signs and holds in their own
  wallet / Safe / authenticated Bankr session / local runtime. HISS prepares;
  the user's own authority executes (`EXECUTION_AUTHORITY_REQUIRED` when none is
  connected).
- There is **no HISS-custodied middle path** between managed and self-signed:
  HISS never holds keys, never signs, never submits, never takes custody.

## What the managed book is NOT

- Not a fund, not a guaranteed return, not "passive income." Fees are not profit;
  a position's inventory value can fall while it accrues fees.
- The manager does not hedge, short, or place brokerage orders.
