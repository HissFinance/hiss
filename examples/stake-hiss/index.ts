/**
 * stake-hiss — build an UNSIGNED stake plan and show the xHISS exit timing.
 *
 * Staking mints xHISS at the current rate; fee-funded injections raise the
 * HISS-per-xHISS share value over time. This is NOT a performance claim and NOT
 * a yield product. Exiting requires a cooldown then a redeem window. This script
 * never signs or sends anything.
 */
import { buildStakePlan, XHISS_COPY, XHISS_TIMING, formatDuration } from "@hiss-finance/react";

const AMOUNT_BASE_UNITS = (250n * 10n ** 18n).toString(); // 250 HISS

const result = buildStakePlan({
  amountBaseUnits: AMOUNT_BASE_UNITS,
  account: "0x00000000000000000000000000000000000000A1",
});

if (!result.valid) {
  console.error("Invalid input:", result.errors);
  process.exit(1);
}

console.log(XHISS_COPY.headline);
console.log("");
console.log(`Plan:     ${result.plan!.title}`);
console.log(`Executed: ${result.plan!.executed}`);
console.log(`Cooldown: ${formatDuration(XHISS_TIMING.cooldownSeconds)}`);
console.log(`Redeem:   ${formatDuration(XHISS_TIMING.redeemWindowSeconds)} window after cooldown`);
console.log("Notes:");
for (const note of result.plan!.notes) console.log(`  - ${note}`);
console.log("");
console.log(XHISS_COPY.disclaimer, XHISS_COPY.historicalNote);
