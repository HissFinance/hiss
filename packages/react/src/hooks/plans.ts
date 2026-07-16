/**
 * Plan hooks. These are thin, memoized wrappers over the pure builders in
 * `../plans`. They compute a {@link PlanResult} synchronously from their input
 * — no network, no signing, no execution. A `null` plan means the input did
 * not validate; read `errors` to show why.
 */

import { useMemo } from "react";
import {
  buildCooldownPlan,
  buildRedeemPlan,
  buildStakePlan,
  buildVaultCreatePlan,
  buildVaultDepositPlan,
  type CooldownInput,
  type RedeemInput,
  type StakeInput,
  type VaultCreateInput,
  type VaultDepositInput,
} from "../plans";

export function useVaultDepositPlan(input: VaultDepositInput) {
  return useMemo(
    () => buildVaultDepositPlan(input),
    [input.vaultAddress, input.amountBaseUnits, input.account, input.chainId, input.assetSymbol],
  );
}

export function useVaultCreatePlan(input: VaultCreateInput) {
  const weightsKey = JSON.stringify(input.weights ?? []);
  return useMemo(
    () => buildVaultCreatePlan(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.name, input.slug, input.account, input.chainId, weightsKey],
  );
}

export function useStakePlan(input: StakeInput) {
  return useMemo(
    () => buildStakePlan(input),
    [input.amountBaseUnits, input.account, input.chainId, input.shareRate],
  );
}

export function useCooldownPlan(input: CooldownInput) {
  return useMemo(
    () => buildCooldownPlan(input),
    [input.shareBaseUnits, input.account, input.chainId, input.nowSeconds],
  );
}

export function useRedeemPlan(input: RedeemInput) {
  return useMemo(
    () => buildRedeemPlan(input),
    [
      input.shareBaseUnits,
      input.account,
      input.receiver,
      input.chainId,
      input.redeemWindowOpensAt,
      input.redeemWindowClosesAt,
      input.nowSeconds,
    ],
  );
}
