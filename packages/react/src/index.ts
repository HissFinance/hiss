/**
 * @hiss-finance/react — headless React hooks and composable components for the
 * HISS Finance protocol on Robinhood Chain.
 *
 * Design principles:
 * - Headless & unopinionated: hooks read from a {@link HissClient} you supply;
 *   components style via `--hiss-*` CSS variables.
 * - Truth-first: reads carry explicit provenance; a failed read is `unknown`,
 *   never silently "live". Performance charts render only observed data.
 * - No execution: plan hooks/components describe transactions a user MAY sign;
 *   this package never signs, sends, or takes custody of anything.
 *
 * Apache-2.0.
 */

export { HissProvider, useHissClient, type HissProviderProps } from "./context";

export * from "./hooks";
export * from "./components";

export { createMockHissClient, type MockHissClientOverrides } from "./client/mockClient";

// Pure plan builders (usable without React).
export {
  buildVaultDepositPlan,
  buildVaultCreatePlan,
  buildStakePlan,
  buildCooldownPlan,
  buildRedeemPlan,
  type VaultDepositInput,
  type VaultCreateInput,
  type StakeInput,
  type CooldownInput,
  type RedeemInput,
} from "./plans";

// Formatting helpers.
export { truncateAddress, formatBaseUnits, bpsToPercent, formatDuration } from "./internal/format";

// Public constants.
export {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_PUBLIC_RPC_URL,
  ROBINHOOD_EXPLORER_URL,
  HISS_ADDRESSES,
  XHISS_TIMING,
  XHISS_COPY,
  explorerAddressUrl,
  explorerTxUrl,
} from "./constants";

export type * from "./types";
