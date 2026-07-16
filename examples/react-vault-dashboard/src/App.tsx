/**
 * A tiny read-only dashboard built from @hiss-finance/react hooks + components.
 *
 * It uses createMockHissClient so it runs with no RPC or SDK. To show LIVE
 * data, swap the client for the one from @hiss-finance/sdk:
 *
 *   import { createHissClient } from "@hiss-finance/sdk";
 *   const client = createHissClient();
 *
 * Nothing here signs or sends a transaction.
 */
import {
  HissProvider,
  ChainStatus,
  VaultSummary,
  VaultAllocation,
  VaultPerformanceChart,
  RewardLifecycle,
  StakePanel,
  ActionPlanReview,
  useVaults,
  useVaultPerformance,
  useRewardStatus,
  useStakePlan,
  createMockHissClient,
} from "@hiss-finance/react";
import "@hiss-finance/react/styles.css";

// Demo data lives only in the mock; performance is a small illustrative series.
const client = createMockHissClient({
  holdings: {
    "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6": [
      { symbol: "AAPL", weightBps: 4000 },
      { symbol: "MSFT", weightBps: 3500 },
      { symbol: "NVDA", weightBps: 2500 },
    ],
  },
  performance: {
    "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6": [
      { at: "2026-07-10T00:00:00Z", value: "1.000" },
      { at: "2026-07-12T00:00:00Z", value: "1.004" },
      { at: "2026-07-14T00:00:00Z", value: "1.002" },
      { at: "2026-07-16T00:00:00Z", value: "1.009" },
    ],
  },
});

function Dashboard() {
  const vaults = useVaults();
  const first = vaults.data?.[0];
  const perf = useVaultPerformance(first?.address);
  const rewards = useRewardStatus();
  const stake = useStakePlan({
    amountBaseUnits: (100n * 10n ** 18n).toString(),
    account: "0x00000000000000000000000000000000000000A1",
  });

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem", display: "grid", gap: 16 }}>
      <h1>HISS Vault Dashboard</h1>
      <p style={{ opacity: 0.7 }}>Read-only demo using the mock client. No wallet, no signing.</p>

      <ChainStatus status="live" />

      {vaults.loading ? <p>Loading vaults…</p> : null}
      {first ? <VaultSummary vault={first} /> : null}
      {first?.holdings ? <VaultAllocation holdings={first.holdings} /> : null}

      <h2>Performance</h2>
      <VaultPerformanceChart points={perf.data?.points ?? []} />

      <h2>Rewards</h2>
      {rewards.data ? <RewardLifecycle legs={rewards.data.legs} /> : <p>Loading…</p>}

      <h2>Stake</h2>
      <StakePanel>
        <ActionPlanReview plan={stake.plan} errors={stake.errors} />
      </StakePanel>
    </main>
  );
}

export function App() {
  return (
    <HissProvider client={client}>
      <Dashboard />
    </HissProvider>
  );
}
