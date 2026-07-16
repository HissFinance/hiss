/**
 * prepare-vault-deposit — build an UNSIGNED deposit plan.
 *
 * The plan is data describing a transaction you MAY choose to sign in your own
 * wallet. This script never signs or sends anything. Deposit availability is a
 * live on-chain read; confirm the vault is open before signing.
 */
import { buildVaultDepositPlan, HISS_ADDRESSES } from "@hiss-finance/react";

// 100 USDG expressed in 18-decimal base units.
const AMOUNT_BASE_UNITS = (100n * 10n ** 18n).toString();

const result = buildVaultDepositPlan({
  vaultAddress: HISS_ADDRESSES.flagshipVault,
  amountBaseUnits: AMOUNT_BASE_UNITS,
  account: "0x00000000000000000000000000000000000000A1",
  assetSymbol: "USDG",
});

if (!result.valid) {
  console.error("Invalid input:", result.errors);
  process.exit(1);
}

console.log(`Plan:      ${result.plan!.title}`);
console.log(`Signed:    no (requiresSignature=${result.plan!.requiresSignature})`);
console.log(`Executed:  ${result.plan!.executed}`);
for (const step of result.plan!.steps) {
  console.log(`Step:      ${step.summary}`);
  console.log(`           chain ${step.chainId}, to ${step.to}`);
}
console.log("Notes:");
for (const note of result.plan!.notes) console.log(`  - ${note}`);
