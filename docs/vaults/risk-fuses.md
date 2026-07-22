# Risk fuses

**Risk fuses** are the safety constraints in a vault's `rebalancePolicy`. They bound
what a vault may hold and how it may rebalance. Fuses are validated when a manifest is
composed and enforced around rebalances. They **fail closed**: a rebalance that would
violate a fuse is refused.

## The fuses

| Fuse                                            | Purpose                                             | Example (flagship)           |
| ----------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| `maxAllocationPerAssetBps`                      | Cap on any single asset                             | 3,000 (30%)                  |
| `maxAllocationPerProviderBps`                   | Cap on exposure per provider                        | 8,000                        |
| `maxTokenizedEquityExposureBps`                 | Cap on tokenized-equity exposure                    | 7,000                        |
| `maxEtfExposureBps`                             | Cap on ETF exposure                                 | 6,000                        |
| `minUsdgCashReserveBps`                         | Minimum USDG cash reserve                           | 1,000 (10%)                  |
| `maxRebalanceFrequency`                         | How often rebalances may occur                      | `weekly`                     |
| `maxSlippageBps`                                | Max acceptable slippage per rebalance               | 50 (0.5%)                    |
| `maxPriceStalenessSeconds`                      | Max oracle staleness for a live-rebalanceable asset | 90,000                       |
| `maxDrawdownStopPct`                            | Drawdown stop threshold                             | 25                           |
| `marketSessionPolicy`                           | Market-hours awareness                              | `feed-aware-24-5`            |
| `oracleFreshnessPolicy`                         | Require fresh feeds; max staleness                  | `requireFreshFeeds: true`    |
| `liquidityVenuePolicy`                          | Allowed venues; verified route required             | verified route required      |
| `emergencyPauseEnabled`                         | Owner can pause in an emergency                     | true                         |
| `jurisdictionGateEnabled`                       | Gate deposits/actions by jurisdiction               | true                         |
| `receiptLogging` / `postRebalanceAuditRequired` | Produce receipts and audits                         | true / true                  |
| `legalReadinessStatus`                          | Legal/deposit readiness gate                        | e.g. `candidate` / `blocked` |

## Why fuses exist

Fuses turn "trust me" into enforceable policy. They prevent over-concentration, stale
pricing, excessive slippage, disallowed venues, and rebalancing when the vault is not
legally or operationally ready. Because routing is disabled protocol-wide and readiness
gates start conservative, a vault often holds **100% USDG** until per-asset live
rebalance readiness passes.

## Validation

```ts
import { validateRiskFuses } from "@hiss-finance/vault-kit";
const issues = validateRiskFuses(manifest.rebalancePolicy);
if (issues.length) throw new Error(JSON.stringify(issues));
```

Validation is also exposed as the MCP tool `hiss_validate_vault_candidate` and
x402 endpoint `validate-usdg-vault-fuses`. (Autonomy-fuse validation is HTTP-only:
`POST /api/bankrbot/validate-autonomy`.)

## Enforcement at rebalance time

A rebalance is compiled and checked against the fuses (via [CoilOps](../coilops.md))
before a human/wallet acts on it, and reconciled by a **post-run audit** afterward.
Oracle freshness and verified-route requirements mean stale-fed or unverified-venue
assets are not treated as live-rebalanceable.

## The effective deposit gate (advertised availability)

The on-chain `acceptingPublicDeposits()` flag is a **price-blind policy switch** —
it alone never means "deposits work". The hosted product derives an **effective
deposit gate** as the strict AND of every provable condition, and fails closed on
any unknown:

1. `acceptingPublicDeposits()` is true (the raw contract switch);
2. the vault is marked ready in the on-chain deposit-readiness registry;
3. live pricing is usable (a reverting `totalAssets()` means every priced
   deposit/redeem path reverts too);
4. the vault is not paused;
5. **freshness policy (P-DEP-2/P-NAV-2, per-basis):** the tokenized-equity trading
   session is open **and** every required basket asset's feed is within its
   per-basis bound — assets priced on a live exchange feed (`EXCHANGE_LIVE`)
   within **3,600 seconds**, accrual-like assets (`MODEL_ACCRUAL`, e.g. SGOV's
   once-daily round) within **26 hours** (24-hour cadence + 2-hour grace). Any
   unreadable feed age fails closed (unverifiable is never advertised open).

Condition 5 narrows the **advertised** gate beyond the contract: it closes the
weekday overnight window where feeds are quiet (but still inside the contract's
staleness bound) while reference markets move — stale-mark dilution protection for
existing depositors. Weekends were already fail-closed by the contract's
stale-price revert. The narrowing changes the call-to-action, not the contract.

The gate resolves to one of `OPEN` · `MARKET_CLOSED` · `ORACLE_UNAVAILABLE` ·
`PAUSED` · `BLOCKED` · `UNKNOWN`. `UNKNOWN` is distinct from closed: a failed read
proves neither open nor closed, is never advertised as either, and surfaces the
last verified state, labeled — see
[Data freshness](../status-and-data-freshness.md).

## Emergency pause vs exits

`emergencyPauseEnabled` lets the owner pause **rebalances/deposits** in an emergency.
Note the parallel guarantee on the staking side: xHISS **exits are never pausable**
(see [Cooldown and redeem](../staking/cooldown-and-redeem.md)). Pause protects against
unsafe action; it is never used to trap funds.

## Fuses are not performance controls

Fuses constrain **safety and policy**, never predicted returns. A vault can still lose
value within its fuses — there is **no guaranteed yield**. Fuses reduce specific,
enumerated risks; they do not promise an outcome.
