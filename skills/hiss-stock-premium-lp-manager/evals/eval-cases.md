# Evals — hiss-stock-premium-lp-manager

Repo-equivalent eval cases. The generic skill test suite
(`tests/skills/*.test.ts`, run by `pnpm test:skills`) enforces the invariants below
across every landed skill (discovery, claims, execution-boundary, privacy, catalog
consistency, tool-name grounding). These cases document the skill-specific
acceptance bar the maintainer checks by inspection against `SKILL.md`.

## Discovery precision / recall

- SHOULD trigger: "scan Stock-Token premium on Robinhood Chain", "amount-aware
  premium for a $250 GME buy", "preview a one-sided USDG range ladder", "prepare an
  unsigned LP mint I sign myself", "reconcile my LP position's receipt / net P&L".
- SHOULD NOT trigger: generic LP/Uniswap dashboards unrelated to Robinhood Chain
  Stock Tokens; "guaranteed / risk-free arbitrage"; borrowing or shorting Stock
  Tokens; unrestricted wallet execution; arbitrary contract calls; bypassing the
  jurisdiction gate. The frontmatter `description` names both the positive triggers
  and this exclusion set.

## Unsupported-request rejection

- Guaranteed/risk-free profit, arbitrage, borrow/short, sign-for-me, arbitrary
  calldata, unbounded approval, skip-location → the skill refuses and explains why
  (see `examples/failure-states.md`).

## Multiplier correctness

- The multiplier is applied EXACTLY ONCE, feed side only, via `adjustedFeedE18`;
  never twice and never to a pool mark. A doubled or pool-side multiplier is a
  defect.

## Amount-aware pricing

- Premium is direction-specific (`USDG_TO_TOKEN` / `TOKEN_TO_USDG`) and size-
  specific; a single scalar premium is wrong. Confidence is fail-closed
  (`EXECUTION_GRADE` / `DISPLAY_ONLY` / `OVER_CAPACITY` / `UNKNOWN` / `HALTED`).

## Fees ≠ P&L truthfulness

- Anywhere fees appear, the signed real-price-marked net appears beside them; a
  negative net renders negative. The "fees positive / net negative" example is only
  ever a labeled hypothetical, never attributed to HISS or observed data.

## Stale-data handling

- A failed read is "unknown," never "live" or "not deployed." Degraded reads show
  the last verified value with a timestamp and pause new preparation.

## Jurisdiction

- Analysis admits on checks 1–11; live requires check 12 (`retailEligible=true`),
  fail-closed FALSE until owner-resolved. Legal wording is owner-handled and
  preserved verbatim.

## Authorization boundaries

- HISS never holds keys, signs, submits, custodies, hedges, shorts, or places
  orders. Execution is only via the user's own wallet / Safe / smart account /
  local runtime / Bankr session under bounded authorization.

## MCP tool selection

- Reads → `hiss_stock_token_registry` / `hiss_stock_premium_scan` /
  `hiss_stock_premium_explain` / `hiss_lp_ladder_preview` / `hiss_lp_position_read`.
  Prepare → `hiss_lp_prepare_mint` / `_increase` / `_withdraw` / `_collect` /
  `_close`. Verify → `hiss_lp_verify_receipt`. Every tool is read/prepare-only and
  refuses on HALT / UNKNOWN-or-over capacity / jurisdiction-false.

## Deterministic receipts

- Receipts recompute the same hash from the same evidence; a receipt that does not
  verify does not count. A compile/preparation receipt never proves execution;
  settlement is the reconciled on-chain receipt only.

## Frontend-link behavior

- Deep links resolve to `/stock-premium-lp` (+ `/scan`, `/learn`, `/status`);
  compat `/tools/stock-premium-lp` renders the same surface.

## Public-file secret safety

- No signed transaction, private key, Bankr API key, arbitrary calldata, or
  unbounded approval appears in the skill or its references/examples. Verified by
  `pnpm check:secrets` and the privacy scan.
