/**
 * prepare-vault-creation — build an UNSIGNED vault-creation plan.
 *
 * Weights must sum to 10000 bps. The plan describes a transaction you MAY sign;
 * creation is subject to on-chain registry checks and eligibility rules. This
 * script never signs or sends anything.
 */
import { buildVaultCreatePlan } from "@hiss-finance/react";

const result = buildVaultCreatePlan({
  name: "Sample Tech Basket",
  slug: "sample-tech-basket",
  account: "0x00000000000000000000000000000000000000A1",
  weights: [
    { symbol: "AAPL", weightBps: 4000 },
    { symbol: "MSFT", weightBps: 3500 },
    { symbol: "NVDA", weightBps: 2500 },
  ],
});

if (!result.valid) {
  console.error("Invalid manifest input:", result.errors);
  process.exit(1);
}

console.log(`Plan:     ${result.plan!.title}`);
console.log(`Executed: ${result.plan!.executed}`);
console.log(`Step:     ${result.plan!.steps[0]!.summary}`);
console.log("Notes:");
for (const note of result.plan!.notes) console.log(`  - ${note}`);
