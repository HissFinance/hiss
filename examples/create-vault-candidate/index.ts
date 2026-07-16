/**
 * create-vault-candidate — assemble a basket manifest candidate in memory.
 *
 * A candidate is a DRAFT description only. It is not deployed, not live, and
 * confers no ownership. Creating a real vault later is a separate, gated,
 * user-signed action. Stock-Token availability is not universal.
 */
import { slugify, deterministicId, type HissBasketManifest } from "@hiss-finance/core";

const name = "Sample Semiconductor Basket";
const slug = slugify(name);
const now = new Date().toISOString();

const candidate: HissBasketManifest = {
  schemaVersion: "1.0.0",
  id: deterministicId(slug),
  slug,
  name,
  symbol: "SEMI",
  tagline: "Illustrative semiconductor exposure.",
  thesis: "A sample candidate showing manifest structure. Not investment advice.",
  creator: { source: "human", displayName: "example" },
  chain: { chainId: 4663, name: "Robinhood Chain" },
  mode: "paper",
  status: "draft",
  assets: [
    {
      ticker: "NVDA",
      tokenAddress: "0x0000000000000000000000000000000000000001",
      type: "stock",
      weightBps: 5000,
      rationale: "example",
      uiMultiplierSupported: false,
    },
    {
      ticker: "AMD",
      tokenAddress: "0x0000000000000000000000000000000000000002",
      type: "stock",
      weightBps: 3000,
      rationale: "example",
      uiMultiplierSupported: false,
    },
    {
      ticker: "TSM",
      tokenAddress: "0x0000000000000000000000000000000000000003",
      type: "stock",
      weightBps: 2000,
      rationale: "example",
      uiMultiplierSupported: false,
    },
  ],
  rebalance: { method: "drift", cadence: "monthly", driftThresholdBps: 500 },
  risk: {
    maxSingleAssetWeightBps: 6000,
    allowNonCanonicalAssets: false,
    oracleStalenessSeconds: 3600,
    liveExecutionAllowed: false,
    requiresJurisdictionCheck: true,
    notInvestmentAdvice: true,
    notes: ["Illustrative only.", "Stock-Token availability is not universal."],
  },
  social: {
    emoji: "🧪",
    shareTitle: name,
    shareDescription: "Sample candidate basket.",
    hashtags: ["hiss"],
  },
  createdAt: now,
  updatedAt: now,
};

console.log(`Candidate slug: ${candidate.slug}`);
console.log(`Deterministic id: ${candidate.id}`);
console.log(
  `Assets: ${candidate.assets.length}, total weight ${candidate.assets.reduce((s, a) => s + a.weightBps, 0)} bps`,
);
console.log("Status: draft (not deployed, not live, confers no ownership).");
console.log("");
console.log(JSON.stringify(candidate, null, 2));
