/**
 * validate-vault-manifest — run the basket validator over a manifest and print
 * its issues. Validation is fail-closed: any error means the manifest is not
 * eligible to proceed. This does not deploy or sign anything.
 */
import { validateBasketManifest, type HissBasketManifest } from "@hiss-finance/core";

const now = new Date().toISOString();

// A deliberately over-weighted manifest (weights sum to 11000 bps) so the
// validator reports an error.
const manifest: HissBasketManifest = {
  schemaVersion: "1.0.0",
  id: "example-invalid",
  slug: "example-invalid",
  name: "Over-weighted Example",
  symbol: "OVER",
  tagline: "Weights do not sum to 10000 bps.",
  thesis: "Demonstrates a validation error.",
  creator: { source: "human" },
  chain: { chainId: 4663, name: "Robinhood Chain" },
  mode: "paper",
  status: "draft",
  assets: [
    {
      ticker: "AAA",
      tokenAddress: "0x0000000000000000000000000000000000000001",
      type: "stock",
      weightBps: 6000,
      rationale: "example",
      uiMultiplierSupported: false,
    },
    {
      ticker: "BBB",
      tokenAddress: "0x0000000000000000000000000000000000000002",
      type: "stock",
      weightBps: 5000,
      rationale: "example",
      uiMultiplierSupported: false,
    },
  ],
  rebalance: { method: "manual" },
  risk: {
    maxSingleAssetWeightBps: 7000,
    allowNonCanonicalAssets: false,
    oracleStalenessSeconds: 3600,
    liveExecutionAllowed: false,
    requiresJurisdictionCheck: true,
    notInvestmentAdvice: true,
    notes: [],
  },
  social: { emoji: "⚖️", shareTitle: "Over-weighted Example", shareDescription: "demo", hashtags: [] },
  createdAt: now,
  updatedAt: now,
};

const result = validateBasketManifest(manifest);

console.log(`Valid: ${result.valid}`);
if (result.issues.length === 0) {
  console.log("No issues.");
} else {
  console.log("Issues:");
  for (const issue of result.issues) {
    console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
  }
}

process.exit(result.valid ? 0 : 1);
