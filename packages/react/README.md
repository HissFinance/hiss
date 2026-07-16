# @hiss-finance/react

Headless, unopinionated React hooks and composable components for the
[HISS Finance](https://hiss.finance) protocol on Robinhood Chain (chain `4663`).

- **Headless** — hooks read from a `HissClient` you supply; components style via
  `--hiss-*` CSS variables. Bring your own design system.
- **Truth-first** — reads carry explicit provenance (`live` / `degraded` /
  `unknown`). A failed read is never silently reported as live, and performance
  charts render only observed data — never a fabricated line.
- **No execution** — plan hooks and `ActionPlanReview` describe transactions a
  user _may_ choose to sign in their own wallet. This package never signs,
  broadcasts, or takes custody of anything.

License: Apache-2.0. Not affiliated with Robinhood, Bankr, or Chainlink.

## Install

```bash
pnpm add @hiss-finance/react @hiss-finance/sdk @hiss-finance/core react
```

`react` is a peer dependency (`^18.2` or `^19`). Import the optional base
stylesheet once if you want sensible defaults:

```ts
import "@hiss-finance/react/styles.css";
```

## Quick start

```tsx
import { HissProvider, useVaults, VaultSummary, createMockHissClient } from "@hiss-finance/react";

// In production, use the client from @hiss-finance/sdk. The mock client returns
// public constants with honest provenance and is handy for local development.
const client = createMockHissClient();

function App() {
  return (
    <HissProvider client={client}>
      <Vaults />
    </HissProvider>
  );
}

function Vaults() {
  const { data, loading, error } = useVaults();
  if (loading) return <p>Loading…</p>;
  if (error) return <p>Could not load vaults (state unknown).</p>;
  return (
    <>
      {data?.map((v) => (
        <VaultSummary key={v.address} vault={v} />
      ))}
    </>
  );
}
```

## The `HissClient` contract

Every read hook pulls a `HissClient` from `HissProvider`. Any object satisfying
the interface works — the `@hiss-finance/sdk` client is the canonical
implementation, `createMockHissClient()` is provided for tests/examples, and you
can write your own adapter. Implementations must fail closed: on an
unrecoverable read, return a value whose `provenance.status` is `unknown` rather
than fabricating live data.

## Hooks

| Hook                                    | Returns                                     |
| --------------------------------------- | ------------------------------------------- |
| `useHissStatus()`                       | Protocol status + contract directory        |
| `useHissContracts()`                    | Known contract directory                    |
| `useVaults()`                           | Vault summaries                             |
| `useVault(address)`                     | One vault's detail                          |
| `useVaultHoldings(address)`             | Target weights / holdings                   |
| `useVaultPerformance(address)`          | Observed performance points (may be empty)  |
| `useHissBalance(account)`               | $HISS balance                               |
| `useXhissPosition(account)`             | xHISS shares, rate, cooldown                |
| `useRewardStatus()`                     | Reward-split legs + per-leg lifecycle state |
| `useVaultDepositPlan(input)`            | Deposit `ActionPlan` (data only)            |
| `useVaultCreatePlan(input)`             | Vault-candidate `ActionPlan` (data only)    |
| `useStakePlan(input)`                   | Stake `ActionPlan` (data only)              |
| `useCooldownPlan(input)`                | Cooldown `ActionPlan` + projected timing    |
| `useRedeemPlan(input)`                  | Redeem `ActionPlan` (window-validated)      |
| `useReceiptVerification(receipt, opts)` | Structure + optional hash check             |

Read hooks return `{ data, loading, error, refetch }` and abort in-flight
requests on unmount or argument change. Plan hooks are pure and synchronous —
they compute a `{ plan, valid, errors }` result and never touch the network.

## Components

`HissStatusBadge`, `ChainStatus`, `AddressLink`, `VaultSummary`,
`VaultAllocation`, `VaultPerformanceChart` (accessible inline SVG),
`StakePanel`, `CooldownTimeline`, `RewardLifecycle`, `ReceiptCard`,
`ActionPlanReview`.

All components are presentational, accessible, and themable through CSS
variables (see `src/components/styles.css` for the full list).

## Design guarantees

- `VaultPerformanceChart` shows an honest empty state when given fewer than two
  observed points — it never invents a flat or synthetic series.
- `RewardLifecycle` renders a `null` distributor recipient as "not deployed" and
  never conflates `planned` / `funded` / `claimable`.
- `StakePanel` renders the approved mechanical staking copy verbatim; there is
  no yield, APY, or passive-income framing anywhere in this package.
- `ActionPlanReview` always labels plans as unsigned and not executed.

## Development

```bash
pnpm test        # vitest (logic + render tests)
pnpm typecheck   # tsc --noEmit
pnpm build       # emit dist/
```
