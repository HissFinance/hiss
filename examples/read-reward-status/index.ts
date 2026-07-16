/**
 * read-reward-status — read the reward-split legs and their lifecycle state.
 *
 * "planned", "funded", and "claimable" are distinct states and never conflated.
 * A leg whose distributor is not deployed has a null recipient — nothing can
 * move against it. No reward is guaranteed.
 */
import { createHissClient } from "@hiss-finance/sdk";

async function main() {
  const client = createHissClient({ rpcUrl: process.env.HISS_RPC_URL });

  const rewards = await client.getRewardStatus();

  console.log(`Split version: ${rewards.version}`);
  console.log(`Read:          ${rewards.provenance.status}`);
  console.log("Legs:");
  for (const leg of rewards.legs) {
    const recipient = leg.recipient ?? "not deployed";
    console.log(
      `  - ${leg.name.padEnd(18)} ${(leg.bps / 100).toString().padStart(3)}%  ` +
        `${leg.state.padEnd(9)} ${recipient}`,
    );
  }
  console.log("Note: rewards are not guaranteed; funding state is read live.");
}

main().catch((err) => {
  console.error("Read failed (reward status unknown):", err);
  process.exit(1);
});
