/**
 * `prepare*` methods: each returns a typed, UNSIGNED {@link ActionPlan}.
 *
 * Every method encodes calldata with viem against a public ABI and returns a
 * plan for the caller to review and sign with their own wallet or Safe. No
 * method here signs, submits, accepts a private key, or calls a credentialed
 * endpoint. Fail-closed: an unsupported chain, a bad address, or a
 * non-positive amount throws rather than producing a questionable plan.
 */

import { encodeAbiParameters, encodeFunctionData, getAddress, keccak256, toBytes, type Hex } from "viem";
import {
  buildAllocation,
  createVaultManifest as vaultKitCreateVaultManifest,
  validateDeploymentReadiness,
  manifestHash as vaultKitManifestHash,
  type AllocationInput,
  type VaultCandidate,
  type ReadinessResult,
} from "@hiss-finance/vault-kit";
import { ERC20_ABI, VAULT_ABI, VAULT_FACTORY_ABI, VAULT_V2_ABI, VAULT_V2_QUEUE_ABI, XHISS_ABI } from "./abi";
import { ADDRESSES, ROBINHOOD_CHAIN_MAINNET, VAULT_LIFECYCLE } from "./constants";
import { buildActionPlan } from "./plan";
import type { ActionPlan } from "./types";
import { CREATOR_ACKS, DEPOSITOR_ACKS, OWNER_ACTION_ACKS, SIGNING_NOTICE, STAKING_ACKS } from "./copy";

const ZERO_HASH: Hex = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS: `0x${string}` = `0x${"0".repeat(40)}`;

function addr(value: string): `0x${string}` {
  return getAddress(value);
}

function positive(name: string, units: bigint): bigint {
  if (units <= 0n) throw new Error(`${name} must be a positive amount (base units), got ${units}`);
  return units;
}

function assertBps(name: string, bps: number, max = 10_000): number {
  if (!Number.isInteger(bps) || bps < 0 || bps > max) {
    throw new Error(`${name} must be an integer in [0, ${max}] bps, got ${bps}`);
  }
  return bps;
}

// ---------------------------------------------------------------------------
// Vault deposits / withdrawals
// ---------------------------------------------------------------------------

export interface PrepareVaultDepositInput {
  /** Vault (proxy) address to deposit into. Defaults to the canonical V2 vault. */
  vault?: string;
  /** USDG amount in base units (6 decimals). */
  amountUnits: bigint;
  /**
   * Address that receives the vault shares. For the canonical V2 vault this is
   * the queue-request OWNER: it must be the signing wallet, and shares mint to
   * it at epoch settlement (not at enqueue).
   */
  receiver: string;
  /** Provide both to route through `depositWithAcks`; omit for plain `deposit` (V1-style only). */
  acks?: { riskAckHash: Hex; jurisdictionAckHash: Hex };
  /**
   * V2 queue only: request nonce (per-owner namespace, idempotent by derived
   * id). Defaults to the current epoch milliseconds. Supply explicitly for a
   * reproducible plan.
   */
  nonce?: bigint;
  /** V2 queue only: request expiry (unix seconds). Defaults to now + 7 days. */
  deadlineUnix?: bigint;
  /**
   * V2 queue only: minimum shares out at settlement (18 decimals). Defaults to
   * 0 (accepts any epoch clearing rate) — set a floor for slippage protection.
   */
  minOutShares?: bigint;
  chainId?: number;
}

/** True when `vault` is the canonical V2 vault (case-insensitive). */
function isVaultV2Address(vault: string): boolean {
  return vault.toLowerCase() === ADDRESSES.vaultV2.toLowerCase();
}

const V2_QUEUE_ENQUEUE_SIGNATURE =
  "enqueue((bytes32,address,uint8,uint256,uint256,uint64,uint64,uint64,uint8,bytes32,uint256))";

/** Derive the queue request id exactly as the deployed contract does. */
function deriveQueueRequestId(owner: `0x${string}`, flow: 0 | 1, nonce: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "address" }, { type: "uint8" }, { type: "uint256" }],
      ["HISS_REQUEST_QUEUE_V1", addr(ADDRESSES.vaultV2), owner, flow, nonce],
    ),
  );
}

/** Build the V2 queue `enqueue` plan for a DEPOSIT (flow 0) or USDG_REDEMPTION (flow 1). */
function buildV2QueueEnqueuePlan(params: {
  chainId: number;
  owner: `0x${string}`;
  flow: 0 | 1;
  amount: bigint;
  minOut: bigint;
  deadlineUnix: bigint;
  nonce: bigint;
  summary: string;
  warnings: string[];
}): ActionPlan {
  const id = deriveQueueRequestId(params.owner, params.flow, params.nonce);
  const request = {
    id,
    owner: params.owner,
    flow: params.flow,
    amount: params.amount,
    minOut: params.minOut,
    deadlineUnix: params.deadlineUnix,
    seq: 0n,
    epochId: 0n,
    // The contract overwrites seq/epochId/status on enqueue; 1 (PENDING) mirrors
    // the proven mainnet enqueue transactions.
    status: 1,
    evidenceHash: ZERO_HASH,
    nonce: params.nonce,
  } as const;
  const calldata = encodeFunctionData({
    abi: VAULT_V2_QUEUE_ABI,
    functionName: "enqueue",
    args: [request],
  });
  return buildActionPlan({
    chainId: params.chainId,
    target: addr(ADDRESSES.vaultV2RequestQueue),
    function: V2_QUEUE_ENQUEUE_SIGNATURE,
    decodedArgs: {
      id,
      owner: params.owner,
      flow: params.flow === 0 ? "0 (DEPOSIT)" : "1 (USDG_REDEMPTION)",
      amount: params.amount.toString(),
      minOut: params.minOut.toString(),
      deadlineUnix: params.deadlineUnix.toString(),
      nonce: params.nonce.toString(),
    },
    calldata,
    summary: params.summary,
    warnings: params.warnings,
    requiredAcknowledgments: [...DEPOSITOR_ACKS],
  });
}

/**
 * Prepare a USDG deposit. Defaults to the CANONICAL V2 vault, where deposits
 * route through the request queue (`enqueue`, epoch batch settlement) — a
 * separate USDG `approve` for the QUEUE must be signed first. For V1-style
 * vaults this prepares the direct ERC-4626 `deposit`; the legacy V1 flagship
 * is closed to new deposits and is warned as such.
 */
export function prepareVaultDeposit(input: PrepareVaultDepositInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const vault = addr(input.vault ?? ADDRESSES.vaultV2);
  const receiver = addr(input.receiver);
  const amount = positive("amountUnits", input.amountUnits);

  if (isVaultV2Address(vault)) {
    const nonce = input.nonce ?? BigInt(Date.now());
    const deadlineUnix = input.deadlineUnix ?? BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400);
    const minOut = input.minOutShares ?? 0n;
    return buildV2QueueEnqueuePlan({
      chainId,
      owner: receiver,
      flow: 0,
      amount,
      minOut,
      deadlineUnix,
      nonce,
      summary: `Queue a deposit of ${amount} USDG units into the canonical V2 vault (${vault}) via the request queue; shares mint to ${receiver} at epoch settlement.`,
      warnings: [
        SIGNING_NOTICE,
        "Approve USDG for the REQUEST QUEUE (not the vault) before enqueuing.",
        "The request OWNER must be the signing wallet — the queue pulls the USDG escrow from the signer and only the owner (or the vault) may enqueue.",
        "Deposits settle in epoch batches at the epoch clearing rate — shares mint at settlement, not at enqueue. Nothing is instant.",
        ...(minOut === 0n
          ? [
              "minOut is 0: this accepts ANY epoch clearing rate. Set minOutShares to floor the settlement rate.",
            ]
          : []),
        "Enqueue succeeds only while the queue is unpaused and the vault's queue lane is armed — verify with a live read first.",
        "A request past its deadline can be expired and the escrow refunded; the deadline is chain time, never a market-hours gate.",
      ],
    });
  }

  const warnings = [
    SIGNING_NOTICE,
    "Approve USDG for this vault before depositing.",
    "Deposit only into the vault (proxy) address, never a logic/implementation address.",
    "Deposits succeed only while the vault is accepting public deposits — verify with a live read first.",
    ...(vault.toLowerCase() === ADDRESSES.flagshipVault.toLowerCase()
      ? [
          `${VAULT_LIFECYCLE.legacyLabel}. This deposit plan targets the LEGACY vault and can revert — the canonical new-deposit vault is ${ADDRESSES.vaultV2} (queue-routed epoch settlement).`,
        ]
      : []),
  ];

  if (input.acks) {
    const calldata = encodeFunctionData({
      abi: VAULT_ABI,
      functionName: "depositWithAcks",
      args: [amount, receiver, input.acks.riskAckHash, input.acks.jurisdictionAckHash],
    });
    return buildActionPlan({
      chainId,
      target: vault,
      function: "depositWithAcks(uint256,address,bytes32,bytes32)",
      decodedArgs: {
        assets: amount.toString(),
        receiver,
        riskAckHash: input.acks.riskAckHash,
        jurisdictionAckHash: input.acks.jurisdictionAckHash,
      },
      calldata,
      summary: `Deposit ${amount} USDG units into vault ${vault}, minting shares to ${receiver}.`,
      warnings,
      requiredAcknowledgments: [...DEPOSITOR_ACKS],
    });
  }

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [amount, receiver],
  });
  return buildActionPlan({
    chainId,
    target: vault,
    function: "deposit(uint256,address)",
    decodedArgs: { assets: amount.toString(), receiver },
    calldata,
    summary: `Deposit ${amount} USDG units into vault ${vault}, minting shares to ${receiver}.`,
    warnings: [
      ...warnings,
      "This vault may require depositWithAcks — a plain deposit reverts on ack-gated vaults. Supply acks if required.",
    ],
    requiredAcknowledgments: [...DEPOSITOR_ACKS],
  });
}

export interface PrepareVaultWithdrawalInput {
  /** Vault (proxy) address to withdraw from. Defaults to the canonical V2 vault. */
  vault?: string;
  /** Vault shares to redeem, in base units (18 decimals). */
  sharesUnits: bigint;
  /** Address that receives the withdrawn assets. */
  receiver: string;
  /** Owner of the shares being redeemed (defaults to `receiver`). */
  sharesOwner?: string;
  /**
   * V2 only: exit mode. "in_kind" (default) burns shares for the exact
   * pro-rata basket (USDG cash + held tokens) — valuation-free, available
   * 24/7. "queue_usdg" escrows shares into the request queue for a USDG
   * payout at epoch settlement.
   */
  mode?: "in_kind" | "queue_usdg";
  /** V2 queue_usdg only: minimum USDG out at settlement (6 decimals; default 0). */
  minOutUsdg?: bigint;
  /** V2 queue_usdg only: request nonce (defaults to epoch milliseconds). */
  nonce?: bigint;
  /** V2 queue_usdg only: request expiry (unix seconds; default now + 7 days). */
  deadlineUnix?: bigint;
  chainId?: number;
}

/**
 * Prepare a share redemption. Defaults to the CANONICAL V2 vault: an
 * unconditional pro-rata `inKindRedeem` (or, with `mode: "queue_usdg"`, a
 * queue-routed USDG redemption). For V1-style vaults this prepares the
 * ERC-4626 `redeem` — the path for LEGACY V1 flagship balances.
 */
export function prepareVaultWithdrawal(input: PrepareVaultWithdrawalInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const vault = addr(input.vault ?? ADDRESSES.vaultV2);
  const receiver = addr(input.receiver);
  const sharesOwner = addr(input.sharesOwner ?? input.receiver);
  const shares = positive("sharesUnits", input.sharesUnits);

  if (isVaultV2Address(vault)) {
    if (input.mode === "queue_usdg") {
      const nonce = input.nonce ?? BigInt(Date.now());
      const deadlineUnix = input.deadlineUnix ?? BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400);
      const minOut = input.minOutUsdg ?? 0n;
      return buildV2QueueEnqueuePlan({
        chainId,
        owner: receiver,
        flow: 1,
        amount: shares,
        minOut,
        deadlineUnix,
        nonce,
        summary: `Queue a redemption of ${shares} V2 vault-share units for a USDG payout to ${receiver} at epoch settlement.`,
        warnings: [
          SIGNING_NOTICE,
          "Approve the V2 vault share token for the REQUEST QUEUE before enqueuing — the queue escrows the shares.",
          "The request OWNER must be the signing wallet; the USDG payout goes to the owner at settlement.",
          "Redemptions settle in epoch batches at the epoch clearing rate — nothing is instant.",
          ...(minOut === 0n
            ? [
                "minOut is 0: this accepts ANY epoch clearing rate. Set minOutUsdg to floor the settlement payout.",
              ]
            : []),
          "A request past its deadline can be expired and the share escrow refunded.",
        ],
      });
    }

    const calldata = encodeFunctionData({
      abi: VAULT_V2_ABI,
      functionName: "inKindRedeem",
      args: [shares, receiver, sharesOwner],
    });
    return buildActionPlan({
      chainId,
      target: vault,
      function: "inKindRedeem(uint256,address,address)",
      decodedArgs: { shares: shares.toString(), receiver, sharesOwner },
      calldata,
      summary: `Redeem ${shares} V2 vault-share units in kind: ${receiver} receives the exact pro-rata basket (USDG cash + held tokens).`,
      warnings: [
        SIGNING_NOTICE,
        "In-kind redemption pays a PRO-RATA BASKET — USDG cash plus every held token (e.g. Stock Tokens), not USDG only.",
        "Valuation-free and available 24/7; per-asset amounts floor to the vault's favor (dust stays in the vault).",
        'For a USDG-only exit, use mode "queue_usdg" (epoch batch settlement at the clearing rate).',
      ],
      requiredAcknowledgments: [...DEPOSITOR_ACKS],
    });
  }

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "redeem",
    args: [shares, receiver, sharesOwner],
  });

  return buildActionPlan({
    chainId,
    target: vault,
    function: "redeem(uint256,address,address)",
    decodedArgs: { shares: shares.toString(), receiver, sharesOwner },
    calldata,
    summary: `Redeem ${shares} vault-share units from ${vault} to ${receiver}.`,
    warnings: [
      SIGNING_NOTICE,
      "A lockup or notice period may block redemption — the plan is valid but the call can revert until the lockup elapses.",
    ],
    requiredAcknowledgments: [...DEPOSITOR_ACKS],
  });
}

// ---------------------------------------------------------------------------
// Vault creation
// ---------------------------------------------------------------------------

export interface PrepareVaultCreationInput {
  candidate: VaultCandidate;
  /** Where vault fees are routed. */
  feeRecipient: string;
  /** Optional referral recipient (defaults to none). */
  referral?: string;
  /** Optional referral fee in bps (defaults to 0). */
  referralBps?: number;
  /**
   * bytes32 strategy hash. Defaults to keccak256 of the candidate's canonical
   * strategy object so a plan is reproducible from the manifest alone.
   */
  strategyHash?: Hex;
  chainId?: number;
}

/**
 * Prepare a `VaultFactory.createVault(...)` call from a validated candidate.
 * Fail-closed: the candidate must pass {@link validateDeploymentReadiness}.
 * Creating a vault is signed from the creator's OWN wallet; a candidate is
 * never deployed by preparing this plan.
 */
export function prepareVaultCreation(input: PrepareVaultCreationInput): ActionPlan {
  const chainId = input.chainId ?? input.candidate.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const readiness = validateDeploymentReadiness(input.candidate);
  if (!readiness.ready) {
    throw new Error(
      `prepareVaultCreation: candidate is not deployment-ready — ${readiness.errors.map((e) => e.code).join(", ")}`,
    );
  }

  const c = input.candidate;
  const referral = input.referral ? addr(input.referral) : ZERO_ADDRESS;
  const referralBps = assertBps("referralBps", input.referralBps ?? 0, 1_000);
  const performanceFeeBps = assertBps("performanceFeeBps", c.fees.performanceFeeBps, 3_000);
  const minSkinBps = assertBps("minSkinBps", c.minSkinBps, 5_000);
  const strategyHash = input.strategyHash ?? keccak256(toBytes(JSON.stringify(sortValue(c.strategy))));
  const requiredRiskAckHash = (c.jurisdiction.requiredRiskAckHash as Hex | undefined) ?? ZERO_HASH;
  const requiredJurisdictionAckHash =
    (c.jurisdiction.requiredJurisdictionAckHash as Hex | undefined) ?? ZERO_HASH;

  const params = {
    name: c.name,
    symbol: c.symbol,
    feeRecipient: addr(input.feeRecipient),
    referral,
    referralBps,
    performanceFeeBps,
    lockupSeconds: c.lockupSeconds,
    minSkinBps,
    strategyHash,
    strategyNoticePeriod: c.strategy.noticePeriodSeconds,
    usPersonsRestricted: c.jurisdiction.usPersonsRestricted,
    requiredRiskAckHash,
    requiredJurisdictionAckHash,
  } as const;

  const calldata = encodeFunctionData({
    abi: VAULT_FACTORY_ABI,
    functionName: "createVault",
    args: [params],
  });

  return buildActionPlan({
    chainId,
    target: addr(ADDRESSES.vaultFactory),
    function:
      "createVault((string,string,address,address,uint16,uint16,uint32,uint16,bytes32,uint32,bool,bytes32,bytes32))",
    decodedArgs: {
      name: params.name,
      symbol: params.symbol,
      feeRecipient: params.feeRecipient,
      referral: params.referral,
      referralBps: String(params.referralBps),
      performanceFeeBps: String(params.performanceFeeBps),
      lockupSeconds: String(params.lockupSeconds),
      minSkinBps: String(params.minSkinBps),
      strategyHash: params.strategyHash,
      strategyNoticePeriod: String(params.strategyNoticePeriod),
      usPersonsRestricted: String(params.usPersonsRestricted),
      requiredRiskAckHash: params.requiredRiskAckHash,
      requiredJurisdictionAckHash: params.requiredJurisdictionAckHash,
      manifestHash: vaultKitManifestHash(c),
    },
    calldata,
    summary: `Create USDG vault "${params.name}" (${params.symbol}) via VaultFactory.`,
    warnings: [
      SIGNING_NOTICE,
      "createVault collects a USDG creation fee from the signer — approve USDG for the factory first.",
    ],
    requiredAcknowledgments: [...CREATOR_ACKS],
  });
}

// ---------------------------------------------------------------------------
// Vault management (owner-gated)
// ---------------------------------------------------------------------------

export interface PrepareVaultManagementInput {
  vault: string;
  /** Currently supported: pause / unpause via setPaused(bool). */
  action: "setPaused";
  paused: boolean;
  chainId?: number;
}

/** Prepare an owner-gated vault management call (e.g. pause / unpause). */
export function prepareVaultManagementAction(input: PrepareVaultManagementInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const vault = addr(input.vault);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "setPaused",
    args: [input.paused],
  });

  return buildActionPlan({
    chainId,
    target: vault,
    function: "setPaused(bool)",
    decodedArgs: { paused: String(input.paused) },
    calldata,
    summary: `Set vault ${vault} paused = ${input.paused}.`,
    warnings: [SIGNING_NOTICE],
    requiredAcknowledgments: [...OWNER_ACTION_ACKS],
  });
}

// ---------------------------------------------------------------------------
// $HISS approval + staking
// ---------------------------------------------------------------------------

export interface PrepareApprovalInput {
  /** Token to approve (defaults to $HISS). */
  token?: string;
  /** Spender that may pull the token (e.g. the xHISS vault). */
  spender: string;
  /** Allowance to set, in token base units. */
  amountUnits: bigint;
  chainId?: number;
}

/**
 * Prepare an ERC-20 `approve`. Defaults to approving $HISS (e.g. for the xHISS
 * vault before staking); pass `token` to approve USDG for a vault instead.
 */
export function prepareHissApproval(input: PrepareApprovalInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const token = addr(input.token ?? ADDRESSES.hiss);
  const spender = addr(input.spender);
  if (input.amountUnits < 0n) throw new Error("amountUnits must be non-negative");

  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, input.amountUnits],
  });

  return buildActionPlan({
    chainId,
    target: token,
    function: "approve(address,uint256)",
    decodedArgs: { spender, value: input.amountUnits.toString() },
    calldata,
    summary: `Approve ${spender} to spend ${input.amountUnits} units of token ${token}.`,
    warnings: [
      SIGNING_NOTICE,
      "Approvals grant spending allowance — approve only the exact amount you intend to use.",
    ],
    requiredAcknowledgments: [],
  });
}

/** Alias for {@link prepareHissApproval} that reads clearer for non-HISS tokens. */
export const prepareErc20Approval = prepareHissApproval;

export interface PrepareHissStakeInput {
  /** $HISS amount to stake, in base units (18 decimals). */
  amountUnits: bigint;
  chainId?: number;
}

/** Prepare an xHISS `stake(hissAmount)` call. */
export function prepareHissStake(input: PrepareHissStakeInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const amount = positive("amountUnits", input.amountUnits);

  const calldata = encodeFunctionData({
    abi: XHISS_ABI,
    functionName: "stake",
    args: [amount],
  });

  return buildActionPlan({
    chainId,
    target: addr(ADDRESSES.xhissVault),
    function: "stake(uint256)",
    decodedArgs: { hissAmount: amount.toString() },
    calldata,
    summary: `Stake ${amount} HISS units into the xHISS vault.`,
    warnings: [
      SIGNING_NOTICE,
      "Approve HISS for the xHISS vault before staking.",
      "Exiting requires a cooldown (72h) then a redeem window (2 days) — plan your exit timing.",
    ],
    requiredAcknowledgments: [...STAKING_ACKS],
  });
}

// ---------------------------------------------------------------------------
// xHISS exits
// ---------------------------------------------------------------------------

export interface PrepareXhissCooldownInput {
  action: "start" | "restart" | "cancel";
  /** Required for `start`: xHISS shares to place in cooldown (18 decimals). */
  xShares?: bigint;
  chainId?: number;
}

/** Prepare an xHISS cooldown transition (start / restart / cancel). */
export function prepareXhissCooldown(input: PrepareXhissCooldownInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const target = addr(ADDRESSES.xhissVault);

  if (input.action === "start") {
    if (input.xShares === undefined) throw new Error("prepareXhissCooldown: `start` requires xShares");
    const xShares = positive("xShares", input.xShares);
    const calldata = encodeFunctionData({ abi: XHISS_ABI, functionName: "startCooldown", args: [xShares] });
    return buildActionPlan({
      chainId,
      target,
      function: "startCooldown(uint256)",
      decodedArgs: { xShares: xShares.toString() },
      calldata,
      summary: `Start (or add to) an xHISS cooldown for ${xShares} share units.`,
      warnings: [
        SIGNING_NOTICE,
        "After the 72h cooldown you have a 2-day window to redeem, else restart the cooldown.",
      ],
      requiredAcknowledgments: [...STAKING_ACKS],
    });
  }

  if (input.action === "restart") {
    const calldata = encodeFunctionData({ abi: XHISS_ABI, functionName: "restartCooldown", args: [] });
    return buildActionPlan({
      chainId,
      target,
      function: "restartCooldown()",
      decodedArgs: {},
      calldata,
      summary: "Restart the xHISS cooldown timer for the cooling balance.",
      warnings: [SIGNING_NOTICE],
      requiredAcknowledgments: [...STAKING_ACKS],
    });
  }

  const calldata = encodeFunctionData({ abi: XHISS_ABI, functionName: "cancelCooldown", args: [] });
  return buildActionPlan({
    chainId,
    target,
    function: "cancelCooldown()",
    decodedArgs: {},
    calldata,
    summary: "Cancel the xHISS cooldown and return the cooling shares to the active balance.",
    warnings: [SIGNING_NOTICE],
    requiredAcknowledgments: [...STAKING_ACKS],
  });
}

export interface PrepareXhissRedeemInput {
  /** xHISS shares to redeem for $HISS, in base units (18 decimals). */
  xShares: bigint;
  receiver: string;
  chainId?: number;
}

/** Prepare an xHISS `redeem(xShares, receiver)` call. */
export function prepareXhissRedeem(input: PrepareXhissRedeemInput): ActionPlan {
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const receiver = addr(input.receiver);
  const xShares = positive("xShares", input.xShares);

  const calldata = encodeFunctionData({
    abi: XHISS_ABI,
    functionName: "redeem",
    args: [xShares, receiver],
  });

  return buildActionPlan({
    chainId,
    target: addr(ADDRESSES.xhissVault),
    function: "redeem(uint256,address)",
    decodedArgs: { xShares: xShares.toString(), receiver },
    calldata,
    summary: `Redeem ${xShares} xHISS share units for HISS to ${receiver}.`,
    warnings: [SIGNING_NOTICE, "Redeem only works inside the 2-day window after a completed 72h cooldown."],
    requiredAcknowledgments: [...STAKING_ACKS],
  });
}

// ---------------------------------------------------------------------------
// Manifest helpers (re-exported / thin wrappers over @hiss-finance/vault-kit)
// ---------------------------------------------------------------------------

/** Re-export of the vault-kit manifest builder. */
export const createVaultManifest = vaultKitCreateVaultManifest;

/** Validate a vault candidate for deployment readiness. */
export function validateVaultManifest(candidate: VaultCandidate): ReadinessResult {
  return validateDeploymentReadiness(candidate);
}

/**
 * Normalize relative weights (or full allocation inputs) to integer bps that
 * sum to exactly 10,000. Accepts a plain number[] or AllocationInput[].
 */
export function calculateAllocationBps(inputs: readonly number[]): number[];
export function calculateAllocationBps(inputs: readonly AllocationInput[]): number[];
export function calculateAllocationBps(inputs: readonly (number | AllocationInput)[]): number[] {
  if (inputs.length === 0) return [];
  if (typeof inputs[0] === "number") {
    // buildAllocation is the single source of truth for normalization.
    const items = (inputs as readonly number[]).map((weight, i) => ({
      symbol: `A${i}`,
      address: ZERO_ADDRESS,
      weight,
    }));
    return buildAllocation(items).map((a) => a.weightBps);
  }
  return buildAllocation(inputs as readonly AllocationInput[]).map((a) => a.weightBps);
}

// Local canonical sort, matching the plan-hash serializer, for strategy hashing.
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}
