/**
 * Local, fail-closed VaultManifest validation.
 *
 * This mirrors the public HISS USDG Creator Vault rules so the CLI can reject
 * a bad manifest before it ever reaches the SDK or the chain:
 *   - Robinhood Chain only (4663 mainnet / 46630 testnet). Base is never a
 *     vault chain and is rejected here.
 *   - Canonical USDG base asset.
 *   - Source-verified allowed assets (non-empty symbol list).
 *   - Fee bounds enforced (management / performance / routing).
 *   - Creator skin-in-the-game required (> 0).
 *   - Mandatory rebalance fuses present.
 * It returns a verdict; it never throws on an invalid manifest.
 */

export const ROBINHOOD_CHAIN_IDS = [4663, 46630] as const;
export type RobinhoodChainId = (typeof ROBINHOOD_CHAIN_IDS)[number];

export const VAULT_MANIFEST_SCHEMA = "vault-manifest-1.0.0";
export const VAULT_BASE_ASSET = "USDG";

export const FEE_BOUNDS = {
  managementBps: { min: 0, max: 500 },
  performanceBps: { min: 0, max: 3000 },
  routingBps: { min: 0, max: 100 },
} as const;

export const REQUIRED_REBALANCE_FUSES = [
  "maxAssetWeightBps",
  "maxSlippageBps",
  "maxDailyTurnoverBps",
] as const;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export interface ValidationVerdict {
  ok: boolean;
  schema: string;
  issues: ValidationIssue[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Validate a VaultManifest fail-closed. Always returns a verdict. */
export function validateVaultManifest(manifest: unknown): ValidationVerdict {
  const issues: ValidationIssue[] = [];
  const push = (code: string, message: string, path: string) => issues.push({ code, message, path });

  if (!isRecord(manifest)) {
    return {
      ok: false,
      schema: VAULT_MANIFEST_SCHEMA,
      issues: [{ code: "NOT_AN_OBJECT", message: "Manifest must be a JSON object.", path: "" }],
    };
  }

  if (manifest.schema !== VAULT_MANIFEST_SCHEMA) {
    push("SCHEMA_MISMATCH", `Expected schema "${VAULT_MANIFEST_SCHEMA}".`, "schema");
  }

  const chainId = num(manifest.chainId);
  if (chainId === null || !ROBINHOOD_CHAIN_IDS.includes(chainId as RobinhoodChainId)) {
    push(
      "CHAIN_NOT_ROBINHOOD",
      `Vault chain must be Robinhood Chain (${ROBINHOOD_CHAIN_IDS.join(" or ")}). Base is never a vault chain.`,
      "chainId",
    );
  }

  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
    push("NAME_REQUIRED", "A non-empty vault name is required.", "name");
  }

  if (manifest.baseAsset !== VAULT_BASE_ASSET) {
    push("BASE_ASSET_INVALID", `Base asset must be ${VAULT_BASE_ASSET}.`, "baseAsset");
  }

  const allowed = manifest.allowedAssets;
  if (
    !Array.isArray(allowed) ||
    allowed.length === 0 ||
    !allowed.every((a) => typeof a === "string" && a.length > 0)
  ) {
    push(
      "ALLOWED_ASSETS_INVALID",
      "allowedAssets must be a non-empty array of source-verified asset symbols.",
      "allowedAssets",
    );
  }

  const fees = manifest.fees;
  if (!isRecord(fees)) {
    push("FEES_REQUIRED", "A fees object is required.", "fees");
  } else {
    for (const [field, bound] of Object.entries(FEE_BOUNDS)) {
      const raw = fees[field];
      // routingBps is optional; management/performance are required.
      if (raw === undefined) {
        if (field !== "routingBps") push("FEE_MISSING", `fees.${field} is required.`, `fees.${field}`);
        continue;
      }
      const value = num(raw);
      if (value === null || value < bound.min || value > bound.max) {
        push(
          "FEE_OUT_OF_BOUNDS",
          `fees.${field} must be an integer bps in [${bound.min}, ${bound.max}].`,
          `fees.${field}`,
        );
      }
    }
  }

  const creator = manifest.creator;
  if (!isRecord(creator)) {
    push("CREATOR_REQUIRED", "A creator object is required.", "creator");
  } else {
    if (typeof creator.address !== "string" || !ADDRESS_RE.test(creator.address)) {
      push(
        "CREATOR_ADDRESS_INVALID",
        "creator.address must be a 0x-prefixed 20-byte address.",
        "creator.address",
      );
    }
    const skin = num(creator.skinInGameUsdg);
    if (skin === null || skin <= 0) {
      push(
        "CREATOR_SKIN_REQUIRED",
        "creator.skinInGameUsdg must be greater than 0 (creator skin-in-the-game is mandatory).",
        "creator.skinInGameUsdg",
      );
    }
  }

  const rebalance = manifest.rebalance;
  if (!isRecord(rebalance) || !isRecord(rebalance.fuses)) {
    push("REBALANCE_FUSES_REQUIRED", "rebalance.fuses is required.", "rebalance.fuses");
  } else {
    const fuses = rebalance.fuses as Record<string, unknown>;
    for (const fuse of REQUIRED_REBALANCE_FUSES) {
      if (num(fuses[fuse]) === null) {
        push(
          "REBALANCE_FUSE_MISSING",
          `rebalance.fuses.${fuse} must be a numeric bound.`,
          `rebalance.fuses.${fuse}`,
        );
      }
    }
  }

  return { ok: issues.length === 0, schema: VAULT_MANIFEST_SCHEMA, issues };
}
