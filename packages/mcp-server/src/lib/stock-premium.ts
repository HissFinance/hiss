/**
 * Stock Premium engine bridge — the injected engine INTERFACE and a
 * deterministic DEMO fixture implementation.
 *
 * The public `@hiss-finance/mcp-server` ships the 11 Stock-Premium tool
 * DEFINITIONS plus this `StockPremiumEngine` interface. The interface is
 * satisfied two ways:
 *
 *   1. `stockPremiumFixtureEngine` (this file) — a self-contained, deterministic
 *      DEMO engine so the public package is testable with no private
 *      dependencies. Every result carries `dataMode: "DEMO"`.
 *   2. The private deployment injects the REAL `@hiss/core` Stock-Premium engine
 *      through `ServerDeps.stockPremium` (dependency injection). The private
 *      adapter maps the identical DTO shapes onto `@hiss/core`
 *      `buildStockTokenRegistry` / `computePremiumPoint` / `buildLadder` /
 *      `prepareLpIntent` / receipt builders, so the engine implementation stays
 *      private while the 11 public tool defs and the DTO contract are shared.
 *
 * Boundary (identical to the rest of this server): READ + PREPARE only. Every
 * prepared package is UNSIGNED — `signed: false`, `liveTransactionSent: false`,
 * `preparedByHiss: true`. There is no code path that signs, submits, custodies,
 * or moves funds. A prepared package is NEVER evidence that anything happened
 * on chain. This is a bounded, uncertain strategy surface — never arbitrage,
 * never a guaranteed return; a positive premium is size-dependent and uncertain,
 * and LP fees are not profit.
 *
 * Truth rules enforced in the DTOs:
 *   - A value that cannot be computed is `null` (rendered "unknown") — UNKNOWN is
 *     NEVER represented as zero.
 *   - `dataMode` is per-result provenance ("DEMO" here), never a global LIVE badge.
 */

import { canonicalHash } from "./hash.js";
import type { JsonRecord } from "./types.js";

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/**
 * Data plane behind a response.
 *  - "LIVE": a real chain-4663 read (a genuine observedBlock proves it).
 *  - "DEGRADED": a partial/failed live read — carries precise reasons + null
 *     fields, NEVER a fabricated value and NEVER a demo substitute.
 *  - "DEMO": the deterministic fixture engine (tests / local / ?dataMode=demo).
 *     Production read tools must NEVER report DEMO.
 */
export type StockPremiumDataMode = "DEMO" | "LIVE" | "DEGRADED";
export type PremiumDirection = "USDG_TO_TOKEN" | "TOKEN_TO_USDG";
export type StockPremiumFuseState = "PASS" | "WARN" | "DEGRADED" | "HALT" | "UNKNOWN";
export type StockPremiumConfidence =
  "EXECUTION_GRADE" | "DISPLAY_ONLY" | "OVER_CAPACITY" | "HALTED" | "UNKNOWN";
export type StockPremiumSupportState = "ADMITTED_ANALYSIS" | "EXCLUDED" | "UNKNOWN";

export type StockPremiumLpOperation = "mint" | "increaseLiquidity" | "decreaseLiquidity" | "collect" | "burn";

/** Typed rejection reasons a prepare may fail-closed on (§5). */
export type StockPremiumRejectReason =
  | "arbitrary_target"
  | "arbitrary_selector"
  | "unknown_pool"
  | "unsupported_token"
  | "wrong_recipient"
  | "expired_evidence"
  | "stale_evidence"
  | "failed_liveness"
  | "unresolved_corporate_action"
  | "peg_failure"
  | "jurisdiction_execution_failure"
  | "capacity_violation"
  | "replay_detected"
  | "unbounded_approval"
  | "fuse_not_passing"
  | "wrong_chain"
  | "zero_amount"
  | "token_id_required"
  | "token_id_forbidden"
  | "invalid_input";

export type StockPremiumRejection = { reason: StockPremiumRejectReason; detail: string };

// ---------------------------------------------------------------------------
// Read DTOs
// ---------------------------------------------------------------------------

/** One admitted/considered Stock Token registry record. */
export type StockTokenRegistryEntryDTO = {
  symbol: string;
  onchainSymbol: string | null;
  /** Canonical on-chain address — IDENTITY. A matching ticker elsewhere is never sufficient. */
  tokenAddress: string;
  usdgAddress: string;
  chainId: number;
  decimals: number | null;
  currentMultiplierE18: string | null;
  pendingMultiplierE18: string | null;
  corporateAction: string;
  tradingHalt: string;
  referenceSource: string;
  /** code-hash discipline verdict for the token + counted pools. */
  codeHashState: "PASS" | "FAIL" | "UNKNOWN";
  usdgPools: Array<{
    poolAddress: string;
    feeTier: number;
    tickSpacing: number;
    usdgIsToken0: boolean;
    token0: string;
    token1: string;
    codeHashMatch: boolean;
    factoryMatch: boolean;
    liquidity: string;
  }>;
  verifiedPoolCount: number;
  supportState: StockPremiumSupportState;
  admittedForAnalysis: boolean;
  liveExecutionEligible: boolean;
  exclusionReason: string | null;
  liveBlockReason: string | null;
  observedBlock: number;
  observedUnix: number;
  evidenceHash: string;
};

export type RegistryResult = {
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  builtAtUnix: number;
  chainId: number;
  entries: StockTokenRegistryEntryDTO[];
};

/** The §4 amount-aware, direction-specific premium observation carried by scan + explain. */
export type PremiumObservationDTO = {
  direction: PremiumDirection;
  symbol: string;
  token: string;
  usdgAddress: string;
  poolAddress: string | null;
  feeTier: number | null;
  codeHashState: "PASS" | "FAIL" | "UNKNOWN";
  observedBlock: number;
  observedUnix: number;

  /** RAW two-sided reference (USD-18 strings). null ⇒ UNKNOWN (never zero). */
  rawBidE18: string | null;
  rawAskE18: string | null;
  multiplierE18: string;
  /** Multiplier applied EXACTLY ONCE, feed side only. */
  multiplierApplied: boolean;
  multiplierApplicationSemantics: string;
  /** referenceBuy/Sell price — multiplier applied once. null ⇒ UNKNOWN. */
  adjustedReferenceE18: string | null;

  exactInput: string;
  exactInputUnit: "USDG_6" | "TOKEN_18";
  simulatedOutput: string;
  simulatedOutputUnit: "TOKEN_18" | "USDG_6";
  executablePriceE18: string | null;

  premiumBps: number | null;
  expectedImpactBps: number | null;
  twapDivergenceBps: number | null;

  referenceAgeSeconds: number | null;
  referenceFreshness: "fresh" | "aging" | "stale" | "unknown";
  liveness: string;
  corporateAction: string;
  usdgPeg: string;

  /** Dynamic safe-notional (USDG 6-dec string). null ⇒ UNKNOWN; "0" ⇒ proven-zero. */
  dynamicCapacityUsdg: string | null;
  confidence: StockPremiumConfidence;
  fuseVerdict: StockPremiumFuseState;
  reasonCodes: string[];
  degradationReason: string | null;
  evidenceHash: string;
  policyVersion: string;
};

export type ScanRowDTO = PremiumObservationDTO & {
  supportState: StockPremiumSupportState;
  liveExecutionEligible: boolean;
  usable: boolean;
  poolLiquidity: string;
  rankScore: number;
};

export type ScanResult = {
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  asOfSeconds: number;
  probeSizeUsdg: string;
  probeSizeLabel: string;
  rankExplainer: string;
  policyVersion: string;
  rows: ScanRowDTO[];
};

export type ExplainResult = {
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  notThesis: string;
  buy: PremiumObservationDTO | null;
  sell: PremiumObservationDTO | null;
};

export type LadderRungDTO = {
  index: number;
  tickLower: number;
  tickUpper: number;
  priceLowerUsdE18: string;
  priceUpperUsdE18: string;
  capital: string;
};

export type LadderPreviewResult = {
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  ok: boolean;
  rejections: StockPremiumRejection[];
  template: "PREMIUM_USDG_BUY_LADDER" | "DISCOUNT_TOKEN_SELL_LADDER" | null;
  posture: "OBSERVE_ONLY" | "SHADOW" | "PREPARE_ONLY" | null;
  poolAddress: string | null;
  feeTier: number | null;
  direction: "BUY" | "SELL" | null;
  currentTick: number | null;
  tickSpacing: number | null;
  spotPriceUsdE18: string | null;
  boundaryPriceUsdE18: string | null;
  rungs: LadderRungDTO[];
  totalCapital: string | null;
  capitalUnit: "USDG_6" | "TOKEN_18" | null;
  allocatedCapital: string | null;
  maxInventoryConversion: { maxStockRawAcquired: string | null; maxUsdgRawAcquired: string | null };
  gasAssumptions: JsonRecord;
  withdrawalAssumptions: JsonRecord;
  notArbitrage: string;
  evidenceHash: string | null;
};

export type PositionReadResult = {
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  tokenId: string;
  found: boolean;
  owner: string | null;
  poolAddress: string | null;
  token0: string | null;
  token1: string | null;
  feeTier: number | null;
  tickLower: number | null;
  tickUpper: number | null;
  liquidity: string | null;
  tokensOwed0: string | null;
  tokensOwed1: string | null;
  note: string;
};

// ---------------------------------------------------------------------------
// Prepare DTOs (§5)
// ---------------------------------------------------------------------------

export type PreparedCallDTO = {
  label: string;
  target: string;
  selector: string;
  calldata: string;
  value: string;
  summary: string;
};

export type PreparedApprovalDTO = {
  token: string;
  tokenSymbol: string;
  spender: string;
  amount: string;
  isExact: true;
  revokesResidual: true;
};

export type PreparedMintRungDTO = {
  index: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
};

/** The full §5 identity + parameter binding every prepared operation carries. */
export type PreparedBindingDTO = {
  chainId: number;
  operation: StockPremiumLpOperation;
  authority: { kind: string; address: string };
  recipient: string;
  positionManager: string;
  positionManagerCodeHash: string;
  factory: string;
  factoryCodeHash: string;
  pool: string;
  poolCodeHash: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTier: number;
  tickSpacing: number;
  usdgIsToken0: boolean;
  strategyVersion: string;
  registryVersion: string;
  riskPolicyVersion: string;
  adapterVersion: string;
  priceMeshEvidenceHash: string;
  ladderEvidenceHash: string | null;
  fuseChecksum: string;
  intentNonce: string;
  deadlineUnix: number;
  tokenId: string | null;
};

export type PreparedIntentDTO = {
  kind: "spl_lp_intent";
  intentId: string;
  binding: PreparedBindingDTO;
  approvals: PreparedApprovalDTO[];
  calls: PreparedCallDTO[];
  rungs: PreparedMintRungDTO[] | null;
  slippageBps: number;
  idempotencyKey: string;
  intentHash: string;
  /** Hard-typed prepare-only invariants. */
  signed: false;
  preparedByHiss: true;
  liveTransactionSent: false;
};

export type PrepareReceiptDTO = {
  receiptId: string;
  stage: "preparation";
  intentId: string;
  intentHash: string;
  callCount: number;
  approvalCount: number;
  liveTransactionSent: false;
  preparedByHiss: true;
  createdAt: string;
};

export type SignatureReviewDTO = {
  operation: StockPremiumLpOperation;
  chainId: number;
  chainName: "Robinhood Chain";
  authority: { kind: string; address: string };
  recipient: string;
  positionManager: string;
  pool: string;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  feeTier: number;
  deadlineUnix: number;
  intentNonce: string;
  policyVersion: string;
  fuse: { aggregate: string; canPrepare: boolean; liveExecutionEligible: boolean; checksum: string };
  whatCanHappenAfterSigning: string[];
  whatHissCannotDoWithoutAnotherAuthorization: string[];
  liveTransactionSent: false;
};

export type PrepareSuccess = {
  ok: true;
  dataMode: StockPremiumDataMode;
  sourceLabel: string;
  intent: PreparedIntentDTO;
  receipt: PrepareReceiptDTO;
  signatureReview: SignatureReviewDTO;
  rejections: [];
};

export type PrepareFailure = {
  ok: false;
  dataMode: StockPremiumDataMode;
  rejections: StockPremiumRejection[];
};

export type PrepareResult = PrepareSuccess | PrepareFailure;

export type VerifyReceiptResult = {
  dataMode: StockPremiumDataMode;
  ok: boolean;
  stage: string | null;
  computedHash: string | null;
  statedHash: string | null;
  /** True ONLY when the receipt carries proof of on-chain settlement — never for a prepare receipt. */
  onchainConfirmed: boolean;
  liveTransactionSent: boolean;
  issues: string[];
};

// ---------------------------------------------------------------------------
// Method input shapes
// ---------------------------------------------------------------------------

export type RegistryInput = { symbol?: string | null };
export type ScanInput = {
  probeUsdg?: string;
  symbol?: string | null;
  state?: string | null;
};
export type ExplainInput = { symbol: string; notionalUsdg?: string };
export type LadderPreviewInput = {
  symbol: string;
  template?: "PREMIUM_USDG_BUY_LADDER" | "DISCOUNT_TOKEN_SELL_LADDER";
  boundaryPriceUsdE18: string;
  rungs?: number;
  totalCapital: string;
};
export type PositionReadInput = { tokenId: string };

export type PrepareAuthority = { kind?: string; address: string };
export type PrepareMintInput = {
  symbol: string;
  authority: PrepareAuthority;
  recipient: string;
  boundaryPriceUsdE18: string;
  totalCapital: string;
  rungs?: number;
  slippageBps?: number;
  intentNonce: string;
  deadlineUnix: number;
  nowUnix?: number;
  /** Optional caller pins — must MATCH canonical pins or reject. */
  assertPositionManager?: string;
  assertFactory?: string;
  assertPool?: string;
  /** Deterministic replay lookup: if `intentNonce` is in this set, reject as replay. */
  seenNonces?: string[];
};
export type PreparePositionInput = {
  symbol: string;
  authority: PrepareAuthority;
  recipient: string;
  tokenId: string;
  poolAddress: string;
  intentNonce: string;
  deadlineUnix: number;
  nowUnix?: number;
  slippageBps?: number;
  addAmount0?: string;
  addAmount1?: string;
  minAmount0?: string;
  minAmount1?: string;
  liquidity?: string;
  amount0Max?: string;
  amount1Max?: string;
  /** Deterministic replay lookup: if `intentNonce` is in this set, reject as replay. */
  seenNonces?: string[];
};
export type VerifyReceiptInput = { receipt: JsonRecord };

// ---------------------------------------------------------------------------
// The injected engine interface
// ---------------------------------------------------------------------------

export interface StockPremiumEngine {
  registry(input?: RegistryInput): Promise<RegistryResult> | RegistryResult;
  scan(input?: ScanInput): Promise<ScanResult> | ScanResult;
  explain(input: ExplainInput): Promise<ExplainResult> | ExplainResult;
  ladderPreview(input: LadderPreviewInput): Promise<LadderPreviewResult> | LadderPreviewResult;
  positionRead(input: PositionReadInput): Promise<PositionReadResult> | PositionReadResult;
  prepareMint(input: PrepareMintInput): Promise<PrepareResult> | PrepareResult;
  prepareIncrease(input: PreparePositionInput): Promise<PrepareResult> | PrepareResult;
  prepareWithdraw(input: PreparePositionInput): Promise<PrepareResult> | PrepareResult;
  prepareCollect(input: PreparePositionInput): Promise<PrepareResult> | PrepareResult;
  prepareClose(input: PreparePositionInput): Promise<PrepareResult> | PrepareResult;
  verifyReceipt(input: VerifyReceiptInput): Promise<VerifyReceiptResult> | VerifyReceiptResult;
}

// ===========================================================================
// Deterministic DEMO fixture engine
// ===========================================================================

const DEMO_MODE: StockPremiumDataMode = "DEMO";
const DEMO_LABEL =
  "DEMO fixtures — hypothetical construction inputs, not live chain reads and not observed performance.";
const POLICY_VERSION = "spl-policy-1.0.0";
const STRATEGY_VERSION = "spl-strategy-1.0.0";
const REGISTRY_VERSION = "spl-registry-1.0.0";
const RISK_POLICY_VERSION = "spl-risk-1.0.0";
const ADAPTER_VERSION = "spl-lp-adapter-1.0.0";
const CHAIN_ID = 4663;

// Canonical DEMO addresses (fixture; the private deployment uses the real pins).
//
// Hash-family fields (code hashes, evidence hashes, intent/idempotency hashes)
// are rendered as BARE lowercase hex (no `0x` prefix) — this matches the real
// `@hiss/core` `hashCanonical` convention AND ensures a receipt re-submitted to
// `hiss_lp_verify_receipt` is never mistaken for a private-key-shaped credential
// (`0x` + exactly 64 hex) by the input guard. It is a representation choice, not
// a guard exemption.
const USDG_ADDRESS = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const POSITION_MANAGER = "0xc36442b4a4522e871399cd717abdd847ab11fe88";
const POSITION_MANAGER_CODE_HASH = "4accca06da0acb01ecf210e02ea98913c9e0cc15222f2398e88c2013465e15e3";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const FACTORY_CODE_HASH = "2a1b6e5f3c9d0a4b7e8f1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f6071";
const POOL_CODE_HASH = "4accca06da0acb01ecf210e02ea98913c9e0cc15222f2398e88c2013465e15e3";

// Uniswap v3 NonfungiblePositionManager selectors + ERC-20 approve.
const SELECTORS = {
  mint: "0x88316456",
  increaseLiquidity: "0x219f5d17",
  decreaseLiquidity: "0x0c49ccbe",
  collect: "0xfc6f7865",
  burn: "0x42966c68",
  approve: "0x095ea7b3",
} as const;

const UINT256_MAX = (1n << 256n) - 1n;

type DemoSpec = {
  symbol: string;
  token: string;
  poolAddress: string;
  feeTier: number;
  tickSpacing: number;
  spotUsd: number;
  liquidity: bigint;
  admittedForAnalysis: boolean;
  liveExecutionEligible: boolean;
  liveBlockReason: string | null;
};

const DEMO_SPECS: DemoSpec[] = [
  {
    symbol: "AAPL",
    token: "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9",
    poolAddress: "0x783c9bbb765047cfdd2b84b92b2ca9f11d34b7ed",
    feeTier: 3000,
    tickSpacing: 60,
    spotUsd: 320,
    liquidity: 14_064_026_635_390_012n,
    admittedForAnalysis: true,
    liveExecutionEligible: false,
    liveBlockReason: "jurisdiction",
  },
  {
    symbol: "GME",
    token: "0x1b0e319c6a659f002271b69db8a7df2f911c153e",
    poolAddress: "0xe2b46c905e12ab8e2f864e4821a4325884c1b126",
    feeTier: 500,
    tickSpacing: 10,
    spotUsd: 25,
    liquidity: 3_016_784_031_307_276_545n,
    admittedForAnalysis: true,
    liveExecutionEligible: false,
    liveBlockReason: "jurisdiction",
  },
];

const E18 = 1_000_000_000_000_000_000n;
const USD_SCALE = 1_000_000_000_000_000_000_000_000_000_000n; // 1e30

function specFor(symbol: string): DemoSpec | undefined {
  return DEMO_SPECS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}

/** Bare lowercase-hex content hash (no `0x`) — guard-safe + real-engine-shaped. */
function fixtureEvidenceHash(body: unknown): string {
  return canonicalHash(body).slice(2);
}

/** Deterministic realizable calldata: a real 4-byte selector + hashed arg block. */
function demoCalldata(selector: string, args: unknown): string {
  const block = canonicalHash(args).slice(2); // 64 hex chars
  return `${selector}${block}`;
}

// --- registry ---------------------------------------------------------------

function registryEntryFor(spec: DemoSpec): StockTokenRegistryEntryDTO {
  const pool = {
    poolAddress: spec.poolAddress,
    feeTier: spec.feeTier,
    tickSpacing: spec.tickSpacing,
    usdgIsToken0: true,
    token0: USDG_ADDRESS,
    token1: spec.token,
    codeHashMatch: true,
    factoryMatch: true,
    liquidity: spec.liquidity.toString(),
  };
  return {
    symbol: spec.symbol,
    onchainSymbol: spec.symbol,
    tokenAddress: spec.token,
    usdgAddress: USDG_ADDRESS,
    chainId: CHAIN_ID,
    decimals: 18,
    currentMultiplierE18: E18.toString(),
    pendingMultiplierE18: null,
    corporateAction: "NONE",
    tradingHalt: "TRADING",
    referenceSource: "LIVE",
    codeHashState: "PASS",
    usdgPools: [pool],
    verifiedPoolCount: 1,
    supportState: "ADMITTED_ANALYSIS",
    admittedForAnalysis: spec.admittedForAnalysis,
    liveExecutionEligible: spec.liveExecutionEligible,
    exclusionReason: null,
    liveBlockReason: spec.liveBlockReason,
    observedBlock: 1000,
    observedUnix: 1_000_000,
    evidenceHash: fixtureEvidenceHash({ kind: "spl-registry", token: spec.token, chain: CHAIN_ID }),
  };
}

// --- premium observation ----------------------------------------------------

function observationFor(
  spec: DemoSpec,
  direction: PremiumDirection,
  notionalUsdg: bigint,
): PremiumObservationDTO {
  const spot18 = BigInt(spec.spotUsd) * E18;
  const halfSpread = spot18 / 2000n; // ~5 bps
  const rawBid = spot18 - halfSpread;
  const rawAsk = spot18 + halfSpread;
  const adjustedReference = direction === "USDG_TO_TOKEN" ? rawAsk : rawBid;

  // Size-aware executable price: a small deterministic impact widens with notional.
  const impactBps = 6 + Number(notionalUsdg / 100_000_000n); // ~6bps + 1bps per 100 USDG
  const clampedImpact = Math.min(impactBps, 80);
  const executable =
    direction === "USDG_TO_TOKEN"
      ? (adjustedReference * BigInt(10_000 + clampedImpact)) / 10_000n
      : (adjustedReference * BigInt(10_000 - clampedImpact)) / 10_000n;

  const premiumBps = Number(((executable - adjustedReference) * 10_000n) / adjustedReference);

  let exactInput: bigint;
  let exactInputUnit: "USDG_6" | "TOKEN_18";
  let simulatedOutput: bigint;
  let simulatedOutputUnit: "TOKEN_18" | "USDG_6";
  if (direction === "USDG_TO_TOKEN") {
    exactInput = notionalUsdg;
    exactInputUnit = "USDG_6";
    // stock out = usdgIn(6-dec)·USD_SCALE / executablePrice(18) → token raw (18-dec)
    simulatedOutput = (notionalUsdg * USD_SCALE) / executable;
    simulatedOutputUnit = "TOKEN_18";
  } else {
    // token in whose spot value ≈ notionalUsdg
    exactInput = (notionalUsdg * USD_SCALE) / spot18;
    exactInputUnit = "TOKEN_18";
    simulatedOutput = (exactInput * executable) / USD_SCALE; // USDG raw (6-dec)
    simulatedOutputUnit = "USDG_6";
  }

  const capacityUsdg = 5_000_000_000n; // 5,000 USDG dynamic safe-notional
  const overCapacity = notionalUsdg > capacityUsdg;

  return {
    direction,
    symbol: spec.symbol,
    token: spec.token,
    usdgAddress: USDG_ADDRESS,
    poolAddress: spec.poolAddress,
    feeTier: spec.feeTier,
    codeHashState: "PASS",
    observedBlock: 1000,
    observedUnix: 1_000_000,
    rawBidE18: rawBid.toString(),
    rawAskE18: rawAsk.toString(),
    multiplierE18: E18.toString(),
    multiplierApplied: true,
    multiplierApplicationSemantics:
      "Multiplier applied EXACTLY ONCE, feed (reference) side only; pool-derived marks are never multiplied.",
    adjustedReferenceE18: adjustedReference.toString(),
    exactInput: exactInput.toString(),
    exactInputUnit,
    simulatedOutput: simulatedOutput.toString(),
    simulatedOutputUnit,
    executablePriceE18: executable.toString(),
    premiumBps,
    expectedImpactBps: clampedImpact,
    twapDivergenceBps: 18,
    referenceAgeSeconds: 30,
    referenceFreshness: "fresh",
    liveness: "OK",
    corporateAction: "NONE",
    usdgPeg: "OK",
    dynamicCapacityUsdg: capacityUsdg.toString(),
    confidence: overCapacity ? "OVER_CAPACITY" : "DISPLAY_ONLY",
    fuseVerdict: "WARN",
    reasonCodes: overCapacity ? ["OVER_CAPACITY", "REFERENCE_DISPLAY_ONLY"] : ["REFERENCE_DISPLAY_ONLY"],
    degradationReason: overCapacity
      ? "notional exceeds dynamic safe-notional; single-range estimate is a conservative under-bound"
      : "producer mark is display-only (NAV alive, live execution not authorized)",
    evidenceHash: fixtureEvidenceHash({
      kind: "spl-premium",
      token: spec.token,
      direction,
      notionalUsdg: notionalUsdg.toString(),
      executable: executable.toString(),
    }),
    policyVersion: POLICY_VERSION,
  };
}

function scanRowFor(spec: DemoSpec, probeUsdg: bigint): ScanRowDTO {
  const buy = observationFor(spec, "USDG_TO_TOKEN", probeUsdg);
  const rank = Math.max(0, 700 - Math.abs(buy.premiumBps ?? 0));
  return {
    ...buy,
    supportState: "ADMITTED_ANALYSIS",
    liveExecutionEligible: spec.liveExecutionEligible,
    usable: true,
    poolLiquidity: spec.liquidity.toString(),
    rankScore: rank,
  };
}

// ---------------------------------------------------------------------------

function parseBig(value: string | undefined, fallback: bigint): bigint {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value))
    throw new StockPremiumInputError(`expected an integer base-unit string, got "${value}".`);
  return BigInt(value);
}

/** Input-shape error (missing/malformed) — distinct from a domain rejection. */
export class StockPremiumInputError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{ code: string; message: string }> = [],
  ) {
    super(message);
    this.name = "StockPremiumInputError";
  }
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function reject(reason: StockPremiumRejectReason, detail: string): PrepareFailure {
  return { ok: false, dataMode: DEMO_MODE, rejections: [{ reason, detail }] };
}

// ---------------------------------------------------------------------------
// Shared prepare validation (§5) — used by every prepare path.
// ---------------------------------------------------------------------------

function validateAuthorityRecipient(
  authority: PrepareAuthority,
  recipient: string,
): StockPremiumRejection | null {
  if (!authority || !ADDRESS_RE.test(authority.address)) {
    return { reason: "invalid_input", detail: "authority.address must be a 20-byte address." };
  }
  if (!ADDRESS_RE.test(recipient)) {
    return { reason: "invalid_input", detail: "recipient must be a 20-byte address." };
  }
  if (authority.address.toLowerCase() !== recipient.toLowerCase()) {
    return {
      reason: "wrong_recipient",
      detail: "recipient MUST equal the signing authority — an arbitrary recipient is rejected.",
    };
  }
  return null;
}

function validateTime(deadlineUnix: number, nowUnix: number): StockPremiumRejection | null {
  if (!Number.isInteger(deadlineUnix) || deadlineUnix <= nowUnix) {
    return {
      reason: "expired_evidence",
      detail: `deadline ${deadlineUnix} must be a future unix time (now ${nowUnix}).`,
    };
  }
  return null;
}

function isReplay(intentNonce: string, seenNonces?: string[]): boolean {
  return Array.isArray(seenNonces) && seenNonces.includes(intentNonce);
}

function buildBinding(
  spec: DemoSpec,
  operation: StockPremiumLpOperation,
  authority: PrepareAuthority,
  recipient: string,
  intentNonce: string,
  deadlineUnix: number,
  tokenId: string | null,
  ladderEvidenceHash: string | null,
): PreparedBindingDTO {
  return {
    chainId: CHAIN_ID,
    operation,
    authority: { kind: authority.kind ?? "user_wallet", address: authority.address },
    recipient,
    positionManager: POSITION_MANAGER,
    positionManagerCodeHash: POSITION_MANAGER_CODE_HASH,
    factory: FACTORY,
    factoryCodeHash: FACTORY_CODE_HASH,
    pool: spec.poolAddress,
    poolCodeHash: POOL_CODE_HASH,
    token0: USDG_ADDRESS,
    token1: spec.token,
    token0Symbol: "USDG",
    token1Symbol: spec.symbol,
    feeTier: spec.feeTier,
    tickSpacing: spec.tickSpacing,
    usdgIsToken0: true,
    strategyVersion: STRATEGY_VERSION,
    registryVersion: REGISTRY_VERSION,
    riskPolicyVersion: RISK_POLICY_VERSION,
    adapterVersion: ADAPTER_VERSION,
    priceMeshEvidenceHash: fixtureEvidenceHash({ kind: "spl-lp-price-mesh", token: spec.token }),
    ladderEvidenceHash,
    fuseChecksum: fixtureEvidenceHash({ kind: "spl-fuse-report", token: spec.token, operation }),
    intentNonce,
    deadlineUnix,
    tokenId,
  };
}

function assembleIntent(
  binding: PreparedBindingDTO,
  approvals: PreparedApprovalDTO[],
  calls: PreparedCallDTO[],
  rungs: PreparedMintRungDTO[] | null,
  slippageBps: number,
  createdAt: string,
): PrepareSuccess {
  const idempotencyKey = canonicalHash({
    strategyVersion: binding.strategyVersion,
    authority: binding.authority.address,
    chainId: binding.chainId,
    pool: binding.pool,
    action: binding.operation,
    nonce: binding.intentNonce,
  }).slice(2);
  const intentHash = canonicalHash({
    binding,
    approvals: approvals.map((a) => ({ token: a.token, spender: a.spender, amount: a.amount })),
    calls: calls.map((c) => ({
      target: c.target,
      selector: c.selector,
      calldata: c.calldata,
      value: c.value,
    })),
    rungs,
    slippageBps,
  }).slice(2);
  const intentId = `splint_${intentHash.slice(0, 24)}`;
  const intent: PreparedIntentDTO = {
    kind: "spl_lp_intent",
    intentId,
    binding,
    approvals,
    calls,
    rungs,
    slippageBps,
    idempotencyKey,
    intentHash,
    signed: false,
    preparedByHiss: true,
    liveTransactionSent: false,
  };
  const receiptBody = {
    stage: "preparation" as const,
    intentId,
    intentHash,
    callCount: calls.length,
    approvalCount: approvals.length,
    liveTransactionSent: false as const,
    preparedByHiss: true as const,
    createdAt,
    binding,
  };
  const receipt: PrepareReceiptDTO = {
    receiptId: `splp_${canonicalHash(receiptBody).slice(2, 22)}`,
    ...receiptBody,
  };
  const signatureReview: SignatureReviewDTO = {
    operation: binding.operation,
    chainId: CHAIN_ID,
    chainName: "Robinhood Chain",
    authority: binding.authority,
    recipient: binding.recipient,
    positionManager: POSITION_MANAGER,
    pool: binding.pool,
    token0: { address: binding.token0, symbol: binding.token0Symbol },
    token1: { address: binding.token1, symbol: binding.token1Symbol },
    feeTier: binding.feeTier,
    deadlineUnix: binding.deadlineUnix,
    intentNonce: binding.intentNonce,
    policyVersion: POLICY_VERSION,
    fuse: {
      aggregate: "WARN",
      canPrepare: true,
      liveExecutionEligible: false,
      checksum: binding.fuseChecksum,
    },
    whatCanHappenAfterSigning: [
      "Your own wallet / Safe / smart-account / keeper may submit these exact calls to the pinned NonfungiblePositionManager.",
      "USDG converts to the Stock Token as price falls into your ranges (a bounded buy ladder). Fees are not profit; inventory value can fall.",
    ],
    whatHissCannotDoWithoutAnotherAuthorization: [
      "HISS holds no keys, never signs, never submits, and cannot change the recipient, pool, or amounts.",
    ],
    liveTransactionSent: false,
  };
  return {
    ok: true,
    dataMode: DEMO_MODE,
    sourceLabel: DEMO_LABEL,
    intent,
    receipt,
    signatureReview,
    rejections: [],
  };
}

// ---------------------------------------------------------------------------
// The fixture engine
// ---------------------------------------------------------------------------

export const stockPremiumFixtureEngine: StockPremiumEngine = {
  registry(input: RegistryInput = {}): RegistryResult {
    const filter = input.symbol?.toLowerCase();
    const specs = filter
      ? DEMO_SPECS.filter(
          (s) => s.symbol.toLowerCase().includes(filter) || s.token.toLowerCase().includes(filter),
        )
      : DEMO_SPECS;
    return {
      dataMode: DEMO_MODE,
      sourceLabel: DEMO_LABEL,
      builtAtUnix: 1_000_000,
      chainId: CHAIN_ID,
      entries: specs.map(registryEntryFor),
    };
  },

  scan(input: ScanInput = {}): ScanResult {
    const probeUsdg = parseBig(input.probeUsdg, 100_000_000n);
    const filter = input.symbol?.toLowerCase();
    let specs = filter
      ? DEMO_SPECS.filter(
          (s) => s.symbol.toLowerCase().includes(filter) || s.token.toLowerCase().includes(filter),
        )
      : DEMO_SPECS;
    if (input.state) {
      const st = input.state.toLowerCase();
      if (st === "usable") specs = specs.filter((s) => s.admittedForAnalysis);
      else if (st === "excluded") specs = specs.filter((s) => !s.admittedForAnalysis);
    }
    const rows = specs.map((s) => scanRowFor(s, probeUsdg)).sort((a, b) => b.rankScore - a.rankScore);
    const probeWhole = Number(probeUsdg) / 1_000_000;
    return {
      dataMode: DEMO_MODE,
      sourceLabel: DEMO_LABEL,
      asOfSeconds: 1_000_000,
      probeSizeUsdg: probeUsdg.toString(),
      probeSizeLabel: `${probeWhole.toLocaleString("en-US")} USDG probe`,
      rankExplainer:
        "Ranked by a bounded, amount-aware, risk-adjusted quality score — never the largest premium alone; " +
        "capacity, impact, freshness, and execution state all bound the score.",
      policyVersion: POLICY_VERSION,
      rows,
    };
  },

  explain(input: ExplainInput): ExplainResult {
    if (!input || typeof input.symbol !== "string" || input.symbol.length === 0) {
      throw new StockPremiumInputError("`symbol` is required.");
    }
    const spec = specFor(input.symbol);
    const notional = parseBig(input.notionalUsdg, 100_000_000n);
    return {
      dataMode: DEMO_MODE,
      sourceLabel: DEMO_LABEL,
      notThesis:
        "A positive premium is a measured, size-dependent, uncertain edge with real inventory + cost paths — never arbitrage and never a guaranteed return.",
      buy: spec ? observationFor(spec, "USDG_TO_TOKEN", notional) : null,
      sell: spec ? observationFor(spec, "TOKEN_TO_USDG", notional) : null,
    };
  },

  ladderPreview(input: LadderPreviewInput): LadderPreviewResult {
    if (!input || typeof input.symbol !== "string") {
      throw new StockPremiumInputError("`symbol` is required.");
    }
    const spec = specFor(input.symbol);
    const template = input.template ?? "PREMIUM_USDG_BUY_LADDER";
    const rejections: StockPremiumRejection[] = [];
    if (!spec)
      rejections.push({
        reason: "unsupported_token",
        detail: `${input.symbol} is not an admitted Stock Token.`,
      });
    const totalCapital = parseBig(input.totalCapital, 0n);
    const boundary = parseBig(input.boundaryPriceUsdE18, 0n);
    const rungCount = Math.max(1, Math.min(20, input.rungs ?? 4));
    if (totalCapital <= 0n) rejections.push({ reason: "zero_amount", detail: "totalCapital must be > 0." });

    if (spec && rejections.length === 0) {
      const spot18 = BigInt(spec.spotUsd) * E18;
      const isBuy = template === "PREMIUM_USDG_BUY_LADDER";
      if (isBuy && boundary >= spot18) {
        rejections.push({ reason: "invalid_input", detail: "BUY floor must be below spot." });
      }
      if (!isBuy && boundary <= spot18) {
        rejections.push({ reason: "invalid_input", detail: "SELL ceiling must be above spot." });
      }
      if (rejections.length === 0) {
        const rungs = buildDemoRungs(spec, isBuy, spot18, boundary, rungCount, totalCapital);
        const allocated = rungs.reduce((s, r) => s + BigInt(r.capital), 0n);
        const maxStock = isBuy ? ((totalCapital * USD_SCALE) / boundary).toString() : null;
        const maxUsdg = !isBuy ? ((totalCapital * boundary) / USD_SCALE).toString() : null;
        return {
          dataMode: DEMO_MODE,
          sourceLabel: DEMO_LABEL,
          ok: true,
          rejections: [],
          template,
          posture: "PREPARE_ONLY",
          poolAddress: spec.poolAddress,
          feeTier: spec.feeTier,
          direction: isBuy ? "BUY" : "SELL",
          currentTick: 0,
          tickSpacing: spec.tickSpacing,
          spotPriceUsdE18: spot18.toString(),
          boundaryPriceUsdE18: boundary.toString(),
          rungs,
          totalCapital: totalCapital.toString(),
          capitalUnit: isBuy ? "USDG_6" : "TOKEN_18",
          allocatedCapital: allocated.toString(),
          maxInventoryConversion: { maxStockRawAcquired: maxStock, maxUsdgRawAcquired: maxUsdg },
          gasAssumptions: {
            labeled: "ASSUMPTION_NOT_MEASURED",
            mintGasUnits: 450_000,
            note: "Per-rung Uniswap v3 mint/collect/burn gas — assumptions, not measured on chain 4663.",
          },
          withdrawalAssumptions: {
            labeled: "ASSUMPTION_NOT_MEASURED",
            perRungIndependentlyWithdrawable: true,
            autoCompounds: false,
            note: "Each rung is a separate LP NFT — independently collectable/burnable; fees do not auto-compound.",
          },
          notArbitrage:
            "A one-sided USDG range below pool price is a bounded buy ladder, never guaranteed arbitrage: fees are not profit and inventory value can fall.",
          evidenceHash: fixtureEvidenceHash({
            kind: "spl-ladder",
            token: spec.token,
            template,
            boundary: boundary.toString(),
            totalCapital: totalCapital.toString(),
            rungs: rungs.map((r) => [r.tickLower, r.tickUpper, r.capital]),
          }),
        };
      }
    }

    return {
      dataMode: DEMO_MODE,
      sourceLabel: DEMO_LABEL,
      ok: false,
      rejections,
      template: null,
      posture: null,
      poolAddress: null,
      feeTier: null,
      direction: null,
      currentTick: null,
      tickSpacing: null,
      spotPriceUsdE18: null,
      boundaryPriceUsdE18: null,
      rungs: [],
      totalCapital: null,
      capitalUnit: null,
      allocatedCapital: null,
      maxInventoryConversion: { maxStockRawAcquired: null, maxUsdgRawAcquired: null },
      gasAssumptions: {},
      withdrawalAssumptions: {},
      notArbitrage:
        "A one-sided USDG range below pool price is a bounded buy ladder, never guaranteed arbitrage.",
      evidenceHash: null,
    };
  },

  positionRead(input: PositionReadInput): PositionReadResult {
    if (!input || typeof input.tokenId !== "string" || !/^\d+$/.test(input.tokenId)) {
      throw new StockPremiumInputError("`tokenId` is required and must be a decimal string.");
    }
    // DEMO: no live position store — return an honest not-found with a full shape,
    // never a fabricated position and never UNKNOWN-as-zero.
    return {
      dataMode: DEMO_MODE,
      sourceLabel: DEMO_LABEL,
      tokenId: input.tokenId,
      found: false,
      owner: null,
      poolAddress: null,
      token0: null,
      token1: null,
      feeTier: null,
      tickLower: null,
      tickUpper: null,
      liquidity: null,
      tokensOwed0: null,
      tokensOwed1: null,
      note: "DEMO fixture engine has no live position store; a live deployment reads the NonfungiblePositionManager on chain 4663. Not found is honest — never a fabricated position.",
    };
  },

  prepareMint(input: PrepareMintInput): PrepareResult {
    const spec = specFor(input.symbol);
    if (!spec) return reject("unsupported_token", `${input.symbol} is not an admitted Stock Token.`);
    if (input.assertPositionManager && input.assertPositionManager.toLowerCase() !== POSITION_MANAGER) {
      return reject(
        "arbitrary_target",
        "caller-supplied position manager does not match the pinned canonical NPM.",
      );
    }
    if (input.assertFactory && input.assertFactory.toLowerCase() !== FACTORY) {
      return reject("unknown_pool", "caller-supplied factory does not match the pinned canonical factory.");
    }
    if (input.assertPool && input.assertPool.toLowerCase() !== spec.poolAddress) {
      return reject(
        "unknown_pool",
        `pool ${input.assertPool} is not a verified registry pool for ${spec.symbol}.`,
      );
    }
    const nowUnix = input.nowUnix ?? 1_000_000;
    const ar = validateAuthorityRecipient(input.authority, input.recipient);
    if (ar) return { ok: false, dataMode: DEMO_MODE, rejections: [ar] };
    if (!input.intentNonce || input.intentNonce.trim().length === 0) {
      return reject("replay_detected", "intentNonce is required for replay protection.");
    }
    const t = validateTime(input.deadlineUnix, nowUnix);
    if (t) return { ok: false, dataMode: DEMO_MODE, rejections: [t] };

    const totalCapital = parseBig(input.totalCapital, 0n);
    const boundary = parseBig(input.boundaryPriceUsdE18, 0n);
    const slippageBps = input.slippageBps ?? 50;
    if (totalCapital <= 0n) return reject("zero_amount", "totalCapital must be > 0.");
    if (totalCapital >= UINT256_MAX)
      return reject("unbounded_approval", "an unbounded approval is rejected — use exact/tight approvals.");
    const spot18 = BigInt(spec.spotUsd) * E18;
    if (boundary >= spot18) return reject("invalid_input", "BUY floor must be below spot.");

    if (isReplay(input.intentNonce, input.seenNonces)) {
      return reject("replay_detected", `nonce ${input.intentNonce} reused for this authority/pool/action.`);
    }

    const rungCount = Math.max(1, Math.min(20, input.rungs ?? 4));
    const rungs = buildDemoRungs(spec, true, spot18, boundary, rungCount, totalCapital);
    const mintRungs: PreparedMintRungDTO[] = [];
    const calls: PreparedCallDTO[] = [];
    let sum = 0n;
    for (const r of rungs) {
      const cap = BigInt(r.capital);
      sum += cap;
      const floor = (cap * BigInt(10_000 - slippageBps)) / 10_000n;
      // Single-sided USDG (token0) for a BUY ladder.
      mintRungs.push({
        index: r.index,
        tickLower: r.tickLower,
        tickUpper: r.tickUpper,
        amount0Desired: cap.toString(),
        amount1Desired: "0",
        amount0Min: floor.toString(),
        amount1Min: "0",
      });
      calls.push({
        label: `mint-rung-${r.index}`,
        target: POSITION_MANAGER,
        selector: SELECTORS.mint,
        calldata: demoCalldata(SELECTORS.mint, {
          token0: USDG_ADDRESS,
          token1: spec.token,
          fee: spec.feeTier,
          tickLower: r.tickLower,
          tickUpper: r.tickUpper,
          amount0Desired: cap.toString(),
          recipient: input.recipient,
          deadline: input.deadlineUnix,
        }),
        value: "0",
        summary: `mint single-sided USDG into ticks [${r.tickLower}, ${r.tickUpper}], recipient ${input.recipient}.`,
      });
    }
    const approvals: PreparedApprovalDTO[] = [
      {
        token: USDG_ADDRESS,
        tokenSymbol: "USDG",
        spender: POSITION_MANAGER,
        amount: sum.toString(),
        isExact: true,
        revokesResidual: true,
      },
    ];
    const binding = buildBinding(
      spec,
      "mint",
      input.authority,
      input.recipient,
      input.intentNonce,
      input.deadlineUnix,
      null,
      fixtureEvidenceHash({ kind: "spl-ladder", token: spec.token, boundary: boundary.toString() }),
    );
    return assembleIntent(
      binding,
      approvals,
      calls,
      mintRungs,
      slippageBps,
      new Date(nowUnix * 1000).toISOString(),
    );
  },

  prepareIncrease(input: PreparePositionInput): PrepareResult {
    return preparePositionOp("increaseLiquidity", input);
  },
  prepareWithdraw(input: PreparePositionInput): PrepareResult {
    return preparePositionOp("decreaseLiquidity", input);
  },
  prepareCollect(input: PreparePositionInput): PrepareResult {
    return preparePositionOp("collect", input);
  },
  prepareClose(input: PreparePositionInput): PrepareResult {
    return preparePositionOp("burn", input);
  },

  verifyReceipt(input: VerifyReceiptInput): VerifyReceiptResult {
    return verifyStockPremiumReceipt(input, DEMO_MODE);
  },
};

/**
 * Pure Stock-Premium receipt verification, shared by the fixture engine and the
 * real `@hiss/core` adapter so verify semantics are identical across both.
 *
 * Integrity here means: the receipt is well-formed AND does not over-claim.
 * A compile/preparation receipt is NEVER evidence of on-chain settlement — it
 * must carry `liveTransactionSent:false`. On-chain settlement is a SEPARATE,
 * explicit proof (`onchainConfirmed`), true only for a settlement receipt with a
 * confirmed tx hash + block + confirmations ≥ 1. `computedHash` is an
 * informational content re-hash of the body — verification never fabricates a
 * settlement claim from a preparation receipt.
 */
export function verifyStockPremiumReceipt(
  input: VerifyReceiptInput,
  dataMode: StockPremiumDataMode = "DEMO",
): VerifyReceiptResult {
  const receipt = input?.receipt;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new StockPremiumInputError("`receipt` must be a JSON object.");
  }
  const rec = receipt as JsonRecord;
  const stage = typeof rec.stage === "string" ? rec.stage : null;
  const statedHash = typeof rec.receiptId === "string" ? rec.receiptId : null;
  const issues: string[] = [];
  if (!stage) issues.push("Receipt is missing a string `stage`.");

  const isPreStage = stage === "compile" || stage === "preparation";
  const claimsLive = rec.liveTransactionSent === true;
  // A prepare-stage receipt claiming a live transaction is a contradiction.
  if (isPreStage && claimsLive) {
    issues.push("A compile/preparation receipt must carry liveTransactionSent:false.");
  }

  const onchainConfirmed =
    stage === "settlement" &&
    typeof rec.txHash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(rec.txHash) &&
    typeof rec.confirmations === "number" &&
    rec.confirmations >= 1;

  // Informational content re-hash of the body (excluding the receiptId). Not a
  // gate: the receiptId is an engine-side prefixed id, not a pure hash of the
  // presented DTO body, so a mismatch is not an integrity failure.
  const { receiptId: _omit, ...body } = rec;
  const computedHash = canonicalHash(body).slice(2);

  return {
    dataMode,
    ok: issues.length === 0,
    stage,
    computedHash,
    statedHash,
    onchainConfirmed,
    liveTransactionSent: claimsLive,
    issues,
  };
}

// ---------------------------------------------------------------------------
// helpers used by both the preview + mint paths
// ---------------------------------------------------------------------------

function buildDemoRungs(
  spec: DemoSpec,
  isBuy: boolean,
  spot18: bigint,
  boundary: bigint,
  rungCount: number,
  totalCapital: bigint,
): LadderRungDTO[] {
  const rungs: LadderRungDTO[] = [];
  const perRung = totalCapital / BigInt(rungCount);
  let allocated = 0n;
  const lo = isBuy ? boundary : spot18;
  const hi = isBuy ? spot18 : boundary;
  const step = (hi - lo) / BigInt(rungCount);
  for (let i = 0; i < rungCount; i++) {
    const capital = i === rungCount - 1 ? totalCapital - allocated : perRung;
    if (i !== rungCount - 1) allocated += perRung;
    const priceLower = lo + step * BigInt(i);
    const priceUpper = i === rungCount - 1 ? hi : lo + step * BigInt(i + 1);
    rungs.push({
      index: i,
      // Ranges sit strictly below the current tick (a BUY ladder). Guard against
      // JS negative zero so JSON round-trip parity holds (-0 → 0).
      tickLower: -(i + 1) * spec.tickSpacing,
      tickUpper: i === 0 ? 0 : -i * spec.tickSpacing,
      priceLowerUsdE18: priceLower.toString(),
      priceUpperUsdE18: priceUpper.toString(),
      capital: capital.toString(),
    });
  }
  return rungs;
}

function preparePositionOp(
  operation: Exclude<StockPremiumLpOperation, "mint">,
  input: PreparePositionInput,
): PrepareResult {
  const spec = specFor(input.symbol);
  if (!spec) return reject("unsupported_token", `${input.symbol} is not an admitted Stock Token.`);
  if (typeof input.poolAddress !== "string" || input.poolAddress.toLowerCase() !== spec.poolAddress) {
    return reject(
      "unknown_pool",
      `pool ${input.poolAddress} is not a verified registry pool for ${spec.symbol}.`,
    );
  }
  const nowUnix = input.nowUnix ?? 1_000_000;
  const ar = validateAuthorityRecipient(input.authority, input.recipient);
  if (ar) return { ok: false, dataMode: DEMO_MODE, rejections: [ar] };
  if (!input.tokenId || !/^\d+$/.test(input.tokenId)) {
    return reject("token_id_required", `${operation} requires a numeric tokenId.`);
  }
  if (!input.intentNonce || input.intentNonce.trim().length === 0) {
    return reject("replay_detected", "intentNonce is required for replay protection.");
  }
  const t = validateTime(input.deadlineUnix, nowUnix);
  if (t) return { ok: false, dataMode: DEMO_MODE, rejections: [t] };

  if (isReplay(input.intentNonce, input.seenNonces)) {
    return reject("replay_detected", `nonce ${input.intentNonce} reused for this authority/pool/action.`);
  }

  const slippageBps = input.slippageBps ?? 50;
  const calls: PreparedCallDTO[] = [];
  const approvals: PreparedApprovalDTO[] = [];
  const deadline = input.deadlineUnix;

  if (operation === "increaseLiquidity") {
    const add0 = parseBig(input.addAmount0, 0n);
    const add1 = parseBig(input.addAmount1, 0n);
    if (add0 <= 0n && add1 <= 0n)
      return reject("zero_amount", "increaseLiquidity requires a positive added amount.");
    if (input.minAmount0 === undefined || input.minAmount1 === undefined) {
      return reject("invalid_input", "increaseLiquidity requires explicit min amounts.");
    }
    if (add0 >= UINT256_MAX || add1 >= UINT256_MAX)
      return reject("unbounded_approval", "an unbounded approval is rejected.");
    if (add0 > 0n)
      approvals.push({
        token: USDG_ADDRESS,
        tokenSymbol: "USDG",
        spender: POSITION_MANAGER,
        amount: add0.toString(),
        isExact: true,
        revokesResidual: true,
      });
    if (add1 > 0n)
      approvals.push({
        token: spec.token,
        tokenSymbol: spec.symbol,
        spender: POSITION_MANAGER,
        amount: add1.toString(),
        isExact: true,
        revokesResidual: true,
      });
    calls.push({
      label: "increaseLiquidity",
      target: POSITION_MANAGER,
      selector: SELECTORS.increaseLiquidity,
      calldata: demoCalldata(SELECTORS.increaseLiquidity, {
        tokenId: input.tokenId,
        add0: add0.toString(),
        add1: add1.toString(),
        deadline,
      }),
      value: "0",
      summary: `increaseLiquidity on position #${input.tokenId} (+${add0} token0, +${add1} token1).`,
    });
  } else if (operation === "decreaseLiquidity") {
    const liquidity = parseBig(input.liquidity, 0n);
    if (liquidity <= 0n) return reject("zero_amount", "decreaseLiquidity (withdraw) requires liquidity > 0.");
    if (input.minAmount0 === undefined || input.minAmount1 === undefined) {
      return reject("invalid_input", "decreaseLiquidity requires explicit min amounts.");
    }
    calls.push({
      label: "decreaseLiquidity",
      target: POSITION_MANAGER,
      selector: SELECTORS.decreaseLiquidity,
      calldata: demoCalldata(SELECTORS.decreaseLiquidity, {
        tokenId: input.tokenId,
        liquidity: liquidity.toString(),
        min0: input.minAmount0,
        min1: input.minAmount1,
        deadline,
      }),
      value: "0",
      summary: `decreaseLiquidity (withdraw) on position #${input.tokenId} (remove ${liquidity} liquidity).`,
    });
  } else if (operation === "collect") {
    const max0 = parseBig(input.amount0Max, 0n);
    const max1 = parseBig(input.amount1Max, 0n);
    if (max0 <= 0n && max1 <= 0n)
      return reject("zero_amount", "collect requires a positive max on at least one side.");
    calls.push({
      label: "collect",
      target: POSITION_MANAGER,
      selector: SELECTORS.collect,
      calldata: demoCalldata(SELECTORS.collect, {
        tokenId: input.tokenId,
        recipient: input.recipient,
        max0: max0.toString(),
        max1: max1.toString(),
      }),
      value: "0",
      summary: `collect fees from position #${input.tokenId} to ${input.recipient}.`,
    });
  } else {
    // burn (close)
    calls.push({
      label: "burn",
      target: POSITION_MANAGER,
      selector: SELECTORS.burn,
      calldata: demoCalldata(SELECTORS.burn, { tokenId: input.tokenId }),
      value: "0",
      summary: `burn (close) empty position #${input.tokenId} (must be fully decreased + collected first).`,
    });
  }

  const binding = buildBinding(
    spec,
    operation,
    input.authority,
    input.recipient,
    input.intentNonce,
    deadline,
    input.tokenId,
    null,
  );
  return assembleIntent(binding, approvals, calls, null, slippageBps, new Date(nowUnix * 1000).toISOString());
}
