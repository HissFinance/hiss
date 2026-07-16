// SPDX-License-Identifier: Apache-2.0
/**
 * VaultManifest — the authored definition of a HISS USDG Creator Vault, and
 * VaultCandidate — a saved-but-not-yet-published draft of one.
 *
 * Vaults live on Robinhood Chain ONLY (4663 mainnet / 46630 testnet); Base is
 * never a vault chain and is rejected by id. The base asset is always USDG
 * (6 decimals). A VaultCandidate is free to save; a VaultManifest is what gets
 * published on-chain (creator skin and the deposit gate apply at publish).
 */

import { hashCanonical } from "../receipts/canonical.js";
import { USDG_ASSET } from "../registry/assets.js";
import {
  ROBINHOOD_CHAIN_MAINNET_ID,
  ROBINHOOD_CHAIN_TESTNET_ID,
  type RobinhoodChainId,
} from "../chain/config.js";
import {
  defaultVaultFeeConfig,
  validateVaultFeeConfig,
  LAUNCH_FEE_SCHEDULE,
  type VaultFeeConfig,
} from "../fees/schedule.js";

export const VAULT_MANIFEST_VERSION = "vault-manifest-1.0.0";
export const VAULT_CANDIDATE_VERSION = "vault-candidate-1.0.0";

export const VAULT_CHAIN_IDS: readonly RobinhoodChainId[] = [
  ROBINHOOD_CHAIN_MAINNET_ID,
  ROBINHOOD_CHAIN_TESTNET_ID,
];

export type VaultManifestIssue = { code: string; message: string };

export type VaultCreatorPolicy = {
  creatorWalletAddress: string;
  /** Minimum creator TVL share while public deposits are open. */
  minCreatorSkinBps: number;
  /** Strategy changes take effect only after this notice period. */
  strategyNoticePeriodSeconds: number;
  creatorAddressPublic: true;
  feeRecipientPublic: true;
};

export type VaultDepositorPolicy = {
  /** Disclosed lockup applied to deposits (0 = none). */
  lockupSeconds: number;
  riskAckRequired: true;
  depositorsShareProfitsAndLosses: true;
  noGuaranteedYield: true;
  notFdicInsured: true;
};

export type VaultManifest = {
  manifestVersion: typeof VAULT_MANIFEST_VERSION;
  slug: string;
  name: string;
  description: string;
  chainId: RobinhoodChainId;
  baseAsset: "USDG";
  baseAssetAddress: string;
  /** Symbols the vault is authorized to hold (registry symbols only). */
  allowedAssetSymbols: string[];
  feeConfig: VaultFeeConfig;
  creatorPolicy: VaultCreatorPolicy;
  depositorPolicy: VaultDepositorPolicy;
  strategyDescriptionHash: string;
  strategyVersion: number;
  /** Robinhood MCP is a per-user brokerage path, never a pooled vault rail. */
  robinhoodMcpUsedForVaultExecution: false;
  createdAt: string;
  updatedAt: string;
};

/**
 * A VaultCandidate is a pre-publication draft. It is free to save and does NOT
 * require creator skin; it becomes a VaultManifest when published on-chain.
 */
export type VaultCandidate = {
  candidateVersion: typeof VAULT_CANDIDATE_VERSION;
  slug: string;
  name: string;
  description: string;
  chainId: RobinhoodChainId;
  baseAsset: "USDG";
  allowedAssetSymbols: string[];
  feeConfig: VaultFeeConfig;
  creatorWalletAddress: string;
  /** Candidates are always free to save. */
  saveFeeUsdg: 0;
  status: "candidate";
  createdAt: string;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate a VaultManifest fail-closed. Empty result = valid. */
export function validateVaultManifest(manifest: unknown): VaultManifestIssue[] {
  const issues: VaultManifestIssue[] = [];
  if (!isRecord(manifest)) {
    return [{ code: "MANIFEST_SHAPE", message: "Vault manifest must be an object." }];
  }
  const m = manifest as Partial<VaultManifest> & Record<string, unknown>;

  if (m.manifestVersion !== VAULT_MANIFEST_VERSION) {
    issues.push({
      code: "MANIFEST_VERSION",
      message: `manifestVersion must be "${VAULT_MANIFEST_VERSION}".`,
    });
  }
  for (const field of ["slug", "name", "description"] as const) {
    if (typeof m[field] !== "string" || !m[field]) {
      issues.push({ code: "MANIFEST_FIELD", message: `${field} must be a non-empty string.` });
    }
  }

  // Chain hard rule: Robinhood Chain only.
  if (typeof m.chainId !== "number" || !VAULT_CHAIN_IDS.includes(m.chainId as RobinhoodChainId)) {
    issues.push({
      code: "VAULT_CHAIN_INVALID",
      message: `Vault chain must be Robinhood Chain (${VAULT_CHAIN_IDS.join(" or ")}); got ${String(m.chainId)}. Base is never a vault chain.`,
    });
  }

  if (m.baseAsset !== "USDG") {
    issues.push({ code: "BASE_ASSET_INVALID", message: "baseAsset must be USDG." });
  }
  if (
    typeof m.baseAssetAddress !== "string" ||
    m.baseAssetAddress.toLowerCase() !== USDG_ASSET.address.toLowerCase()
  ) {
    issues.push({
      code: "BASE_ASSET_INVALID",
      message: "baseAssetAddress must be the canonical USDG contract.",
    });
  }

  if (!Array.isArray(m.allowedAssetSymbols) || m.allowedAssetSymbols.length === 0) {
    issues.push({ code: "ASSETS_REQUIRED", message: "allowedAssetSymbols must be a non-empty array." });
  }

  issues.push(
    ...validateVaultFeeConfig(m.feeConfig).map((i) => ({ code: i.code, message: `feeConfig: ${i.message}` })),
  );

  const creator = m.creatorPolicy;
  if (!isRecord(creator)) {
    issues.push({ code: "CREATOR_POLICY", message: "creatorPolicy must be an object." });
  } else {
    if (
      typeof creator.creatorWalletAddress !== "string" ||
      !ADDRESS_PATTERN.test(creator.creatorWalletAddress)
    ) {
      issues.push({
        code: "CREATOR_POLICY",
        message: "creatorPolicy.creatorWalletAddress must be a public 0x address.",
      });
    }
    if (
      typeof creator.minCreatorSkinBps !== "number" ||
      creator.minCreatorSkinBps < LAUNCH_FEE_SCHEDULE.creatorSkinMinBps ||
      creator.minCreatorSkinBps > 10_000
    ) {
      issues.push({
        code: "CREATOR_SKIN",
        message: `creatorPolicy.minCreatorSkinBps must be in [${LAUNCH_FEE_SCHEDULE.creatorSkinMinBps}, 10000].`,
      });
    }
    if (creator.creatorAddressPublic !== true || creator.feeRecipientPublic !== true) {
      issues.push({
        code: "CREATOR_POLICY",
        message: "Creator address and fee recipient must be public (literally true).",
      });
    }
  }

  const depositor = m.depositorPolicy;
  if (!isRecord(depositor)) {
    issues.push({ code: "DEPOSITOR_POLICY", message: "depositorPolicy must be an object." });
  } else {
    if (typeof depositor.lockupSeconds !== "number" || depositor.lockupSeconds < 0) {
      issues.push({
        code: "DEPOSITOR_POLICY",
        message: "depositorPolicy.lockupSeconds must be a non-negative number.",
      });
    }
    for (const flag of [
      "riskAckRequired",
      "depositorsShareProfitsAndLosses",
      "noGuaranteedYield",
      "notFdicInsured",
    ] as const) {
      if (depositor[flag] !== true) {
        issues.push({ code: "DEPOSITOR_POLICY", message: `depositorPolicy.${flag} must be literally true.` });
      }
    }
  }

  if (m.robinhoodMcpUsedForVaultExecution !== false) {
    issues.push({
      code: "ROBINHOOD_MCP_BOUNDARY",
      message:
        "robinhoodMcpUsedForVaultExecution must be literally false — Robinhood MCP is never a pooled vault rail.",
    });
  }
  if (typeof m.strategyDescriptionHash !== "string" || !m.strategyDescriptionHash) {
    issues.push({ code: "STRATEGY_HASH", message: "strategyDescriptionHash is required." });
  }

  return issues;
}

export type BuildVaultManifestInput = {
  name: string;
  slug: string;
  description: string;
  creatorWalletAddress: string;
  chainId?: RobinhoodChainId;
  allowedAssetSymbols: string[];
  feeConfig?: VaultFeeConfig;
  lockupSeconds?: number;
  minCreatorSkinBps?: number;
  strategyNoticePeriodSeconds?: number;
  nowIso: string;
};

/** Build a VaultManifest with launch defaults and a computed strategy hash. */
export function buildVaultManifest(input: BuildVaultManifestInput): VaultManifest {
  const feeConfig = input.feeConfig ?? defaultVaultFeeConfig(input.creatorWalletAddress);
  const strategyDescriptionHash = hashCanonical({
    name: input.name,
    description: input.description,
    allowedAssetSymbols: [...input.allowedAssetSymbols].sort(),
    feeConfig,
  });
  return {
    manifestVersion: VAULT_MANIFEST_VERSION,
    slug: input.slug,
    name: input.name,
    description: input.description,
    chainId: input.chainId ?? ROBINHOOD_CHAIN_MAINNET_ID,
    baseAsset: "USDG",
    baseAssetAddress: USDG_ASSET.address,
    allowedAssetSymbols: [...input.allowedAssetSymbols],
    feeConfig,
    creatorPolicy: {
      creatorWalletAddress: input.creatorWalletAddress,
      minCreatorSkinBps: input.minCreatorSkinBps ?? LAUNCH_FEE_SCHEDULE.creatorSkinMinBps,
      strategyNoticePeriodSeconds: input.strategyNoticePeriodSeconds ?? 7 * 24 * 3600,
      creatorAddressPublic: true,
      feeRecipientPublic: true,
    },
    depositorPolicy: {
      lockupSeconds: input.lockupSeconds ?? 0,
      riskAckRequired: true,
      depositorsShareProfitsAndLosses: true,
      noGuaranteedYield: true,
      notFdicInsured: true,
    },
    strategyDescriptionHash,
    strategyVersion: 1,
    robinhoodMcpUsedForVaultExecution: false,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
}

/** Content hash of a VaultManifest. */
export function vaultManifestHash(manifest: VaultManifest): string {
  return hashCanonical(manifest);
}
