/**
 * Read hooks. Each returns `{ data, loading, error, refetch }` and fails
 * closed: on error, `data` is undefined and `error` is set — the caller must
 * decide how to render an unknown state, never assume "live" or "absent".
 */

import { useHissClient } from "../context";
import { useAsyncResource, type AsyncResource } from "../internal/useAsyncResource";
import type {
  HissContracts,
  HissStatus,
  RewardStatus,
  TokenBalance,
  VaultDetail,
  VaultHolding,
  VaultPerformance,
  VaultSummaryData,
  XhissPosition,
} from "../types";

/** Protocol-wide status (chain, contract directory, read health). */
export function useHissStatus(): AsyncResource<HissStatus> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getStatus(signal), []);
}

/** The known contract directory for the protocol. */
export function useHissContracts(): AsyncResource<HissContracts> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getContracts(signal), []);
}

/** List of known vaults (summaries). */
export function useVaults(): AsyncResource<VaultSummaryData[]> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getVaults(signal), []);
}

/** A single vault's detail. Pass `undefined` to stay idle. */
export function useVault(address: string | undefined): AsyncResource<VaultDetail> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getVault(address as string, signal), [address], {
    enabled: Boolean(address),
  });
}

/** A vault's current holdings / target weights. */
export function useVaultHoldings(address: string | undefined): AsyncResource<VaultHolding[]> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getVaultHoldings(address as string, signal), [address], {
    enabled: Boolean(address),
  });
}

/** A vault's observed performance series (may be empty — never fabricated). */
export function useVaultPerformance(address: string | undefined): AsyncResource<VaultPerformance> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getVaultPerformance(address as string, signal), [address], {
    enabled: Boolean(address),
  });
}

/** An account's $HISS balance. */
export function useHissBalance(account: string | undefined): AsyncResource<TokenBalance> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getHissBalance(account as string, signal), [account], {
    enabled: Boolean(account),
  });
}

/** An account's xHISS staking position (shares, rate, cooldown). */
export function useXhissPosition(account: string | undefined): AsyncResource<XhissPosition> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getXhissPosition(account as string, signal), [account], {
    enabled: Boolean(account),
  });
}

/** The reward-split status (leg shape + funding state per leg). */
export function useRewardStatus(): AsyncResource<RewardStatus> {
  const client = useHissClient();
  return useAsyncResource((signal) => client.getRewardStatus(signal), []);
}
