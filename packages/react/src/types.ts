/**
 * Public data shapes and the {@link HissClient} contract used by the hooks.
 *
 * These types are intentionally structural and unopinionated. Any object that
 * satisfies {@link HissClient} works — the `@hiss-finance/sdk` client is the
 * canonical implementation, but a mock (see `createMockHissClient`) or your
 * own adapter is equally valid.
 *
 * Truth rules baked into the types:
 * - Read results carry an explicit `verified` provenance, never a bare bool.
 * - Amounts are base-unit decimal strings (never floats) to avoid precision
 *   loss; components format for display only.
 * - "Plans" are data describing a transaction a user MAY choose to sign.
 *   Nothing in this package signs, sends, or executes anything.
 */

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * How confident a read is. A failed fetch is `unknown` — never silently
 * reported as `live` or as `absent`. `degraded` means the value is a last
 * known state that could not be refreshed.
 */
export type ReadStatus = "live" | "degraded" | "unknown";

export type Provenance = {
  status: ReadStatus;
  /** ISO-8601 timestamp of when the underlying data was observed. */
  observedAt?: string;
  /** Optional human-readable note, e.g. the reason a read is degraded. */
  note?: string;
};

// ---------------------------------------------------------------------------
// Protocol status
// ---------------------------------------------------------------------------

export type ContractStatus = "deployed" | "unknown" | "absent";

export type ContractEntry = {
  name: string;
  address: string;
  chainId: number;
  status: ContractStatus;
  /** Optional short role description. */
  role?: string;
};

export type HissStatus = {
  chainId: number;
  network: string;
  /** Overall protocol read health. */
  provenance: Provenance;
  contracts: ContractEntry[];
};

export type HissContracts = {
  chainId: number;
  contracts: ContractEntry[];
};

// ---------------------------------------------------------------------------
// Vaults
// ---------------------------------------------------------------------------

export type VaultDepositState = "open" | "closed" | "unknown";

export type VaultSummaryData = {
  address: string;
  chainId: number;
  name: string;
  /** Settlement asset symbol, e.g. "USDG". */
  assetSymbol?: string;
  depositState: VaultDepositState;
  /** Total value locked, base units of the settlement asset (string). */
  tvlBaseUnits?: string;
  assetDecimals?: number;
  provenance: Provenance;
};

export type VaultDetail = VaultSummaryData & {
  /** Optional manifest slug the vault was created from. */
  basketSlug?: string;
  holdings?: VaultHolding[];
};

export type VaultHolding = {
  /** Underlying position symbol, e.g. a Stock-Token symbol. */
  symbol: string;
  /** Target weight in basis points (0–10000). */
  weightBps: number;
  address?: string;
  /** Current value in settlement-asset base units, when known. */
  valueBaseUnits?: string;
};

/** A single observed performance point. Never fabricate these. */
export type PerformancePoint = {
  /** ISO-8601 timestamp. */
  at: string;
  /** Share value / index value at this point (decimal string). */
  value: string;
};

export type VaultPerformance = {
  address: string;
  /** Ordered oldest→newest. Empty means "no observed history", not "flat". */
  points: PerformancePoint[];
  provenance: Provenance;
};

// ---------------------------------------------------------------------------
// $HISS / xHISS positions
// ---------------------------------------------------------------------------

export type TokenBalance = {
  account: string;
  token: string;
  /** Base units (decimal string). */
  amountBaseUnits: string;
  decimals: number;
  symbol: string;
  provenance: Provenance;
};

export type XhissPosition = {
  account: string;
  /** xHISS share balance, base units. */
  shareBaseUnits: string;
  /** HISS value of the shares at the current rate, base units, when known. */
  assetValueBaseUnits?: string;
  /** HISS-per-xHISS rate as a decimal string (e.g. "1.0234"), when known. */
  shareRate?: string;
  cooldown?: CooldownState;
  provenance: Provenance;
};

export type CooldownState = {
  /** xHISS shares escrowed in cooldown, base units. */
  shareBaseUnits: string;
  /** Unix seconds when the cooldown completes and the redeem window opens. */
  cooldownEndsAt?: number;
  /** Unix seconds when the redeem window closes. */
  redeemWindowEndsAt?: number;
};

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/** A reward leg can be planned, funded, or claimable — never conflate them. */
export type RewardLegState = "planned" | "funded" | "claimable" | "none";

export type RewardLeg = {
  name: string;
  /** Recipient address, or null when the distributor is not deployed. */
  recipient: string | null;
  /** Share of the split in basis points. */
  bps: number;
  state: RewardLegState;
};

export type RewardStatus = {
  /** Split version identifier, e.g. "hiss-reward-split-v1". */
  version: string;
  legs: RewardLeg[];
  provenance: Provenance;
};

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export type ReceiptLike = {
  receiptId: string;
  kind: string;
  /** Always "paper" — receipts are local proofs, not on-chain anchors. */
  anchoring: "paper";
  manifestHash: string;
  generatedAt: string;
  validationStatus?: "valid" | "valid-with-warnings" | "invalid";
  [key: string]: unknown;
};

export type ReceiptVerification = {
  /** True when the receipt is structurally well-formed. */
  wellFormed: boolean;
  /**
   * True when a recomputed content hash matched the receipt's `manifestHash`.
   * `null` when no hash function was supplied (structure-only check).
   */
  hashMatches: boolean | null;
  issues: string[];
};

// ---------------------------------------------------------------------------
// Action plans (data only — never executed by this package)
// ---------------------------------------------------------------------------

/**
 * A description of a single transaction the user MAY choose to sign in their
 * own wallet. This package never signs or broadcasts. `to`/`data` are present
 * only when the caller supplied enough context to encode them.
 */
export type ActionPlanStep = {
  summary: string;
  chainId: number;
  to?: string;
  /** 0x-prefixed calldata, when encodable. */
  data?: string;
  /** Native value in wei (decimal string). Usually "0". */
  value?: string;
};

export type ActionPlan = {
  kind: "vault-deposit" | "vault-create" | "stake" | "cooldown" | "redeem";
  title: string;
  steps: ActionPlanStep[];
  /** Always true: every plan requires the user's own signature to take effect. */
  requiresSignature: true;
  /** Always false: this package never executes plans. */
  executed: false;
  /** Notes/caveats the UI should surface (e.g. availability caveats). */
  notes: string[];
};

export type PlanResult<TInput> = {
  input: TInput;
  plan: ActionPlan | null;
  valid: boolean;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Client contract
// ---------------------------------------------------------------------------

/**
 * The read surface the hooks depend on. Every method is async and returns
 * public, verifiable data. Implementations must fail-closed: on an
 * unrecoverable read, return a value whose `provenance.status` is `unknown`
 * rather than fabricating `live` data.
 *
 * The `@hiss-finance/sdk` client satisfies this contract structurally.
 */
export interface HissClient {
  getStatus(signal?: AbortSignal): Promise<HissStatus>;
  getContracts(signal?: AbortSignal): Promise<HissContracts>;
  getVaults(signal?: AbortSignal): Promise<VaultSummaryData[]>;
  getVault(address: string, signal?: AbortSignal): Promise<VaultDetail>;
  getVaultHoldings(address: string, signal?: AbortSignal): Promise<VaultHolding[]>;
  getVaultPerformance(address: string, signal?: AbortSignal): Promise<VaultPerformance>;
  getHissBalance(account: string, signal?: AbortSignal): Promise<TokenBalance>;
  getXhissPosition(account: string, signal?: AbortSignal): Promise<XhissPosition>;
  getRewardStatus(signal?: AbortSignal): Promise<RewardStatus>;
}
