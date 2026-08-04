/**
 * prepare-vault-deposit-v2 — the CANONICAL deposit example.
 *
 * Targets HISS Vault V2, the canonical new-deposit vault (queue-routed epoch
 * settlement, 24/7 lanes). Three steps:
 *
 *   1. Discover the canonical vault from the SDK's lifecycle constants.
 *   2. Read live V2 status + capacity from chain (fail-soft: a failed read is
 *      UNKNOWN, never fabricated).
 *   3. Build an UNSIGNED queue-deposit plan, plus the in-kind redemption plan
 *      as the exit path.
 *
 * Nothing here signs or sends a transaction. Every plan is data you MAY choose
 * to sign with your own wallet or Safe.
 */
import {
  createHissClient,
  prepareVaultDeposit,
  prepareVaultWithdrawal,
  VAULT_LIFECYCLE,
} from "@hiss-finance/sdk";

// A sample receiver. For the V2 queue this is the request OWNER: it must be
// the signing wallet, and shares mint to it at epoch settlement.
const RECEIVER = "0x00000000000000000000000000000000000000A1";

// 100 USDG in 6-decimal base units.
const AMOUNT_USDG_UNITS = 100_000_000n;

async function main() {
  // 1. Discover the canonical new-deposit vault (never hardcode "the vault").
  console.log("Canonical vault discovery");
  console.log(`  ${VAULT_LIFECYCLE.canonicalLabel}`);
  console.log(`  address: ${VAULT_LIFECYCLE.canonicalDepositVault}`);
  console.log(`  legacy:  ${VAULT_LIFECYCLE.legacyLabel}`);
  console.log();

  // 2. Live V2 status + capacity (fail-soft; degraded reads print as unknown).
  const client = createHissClient({
    // Falls back to the public Robinhood Chain RPC when HISS_RPC_URL is unset.
    rpcUrl: process.env.HISS_RPC_URL,
  });
  const status = await client.getVaultV2Status();
  const show = (r: { state: string; value: unknown }) =>
    r.state === "live" && r.value != null ? String(r.value) : "unknown (degraded read)";

  console.log("Live V2 status (chain reads — never copied from docs)");
  console.log(`  vault paused:        ${show(status.vaultReads.paused)}`);
  console.log(`  queue lane armed:    ${show(status.vaultReads.queueActive)}`);
  console.log(`  queue paused:        ${show(status.queue.paused)}`);
  console.log(`  keeper state:        ${status.keeper.state}`);
  console.log(`  pending deposits:    ${show(status.queue.pendingDepositUsdg)} USDG units`);
  console.log(
    `  deposit capacity:    ${status.capacity.immediateDepositCapacityUsdg ?? "unknown"} USDG units`,
  );
  console.log("  Vault capacity is computed from current onchain liveness evidence. When liveness");
  console.log("  evidence expires, execution capacity fails closed until refreshed.");
  console.log();

  // 3. Build the UNSIGNED queue-deposit plan. The nonce namespaces the request
  //    per owner; supply it explicitly for a reproducible plan.
  const plan = prepareVaultDeposit({
    amountUnits: AMOUNT_USDG_UNITS,
    receiver: RECEIVER,
    nonce: 1n,
    deadlineUnix: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    // minOutShares: set a floor for the epoch clearing rate in real use.
  });

  console.log("Deposit plan (V2 request queue)");
  console.log(`  signed:              false`);
  console.log(`  liveTransactionSent: false`);
  console.log(`  summary:  ${plan.summary}`);
  console.log(`  target:   ${plan.target} (chain ${plan.chainId})`);
  console.log(`  function: ${plan.function}`);
  console.log(`  planHash: ${plan.planHash}`);
  console.log("  warnings:");
  for (const w of plan.warnings) console.log(`    - ${w}`);
  console.log();

  // Exit path: the valuation-free in-kind redemption (available 24/7). It pays
  // the exact pro-rata basket (USDG cash + held tokens). For a USDG-only exit
  // there is a queue fallback: mode "queue_usdg" settles at the epoch clearing
  // rate, like deposits.
  const exitPlan = prepareVaultWithdrawal({
    sharesUnits: 1_000_000_000_000_000_000n, // 1.0 vault share (18 decimals)
    receiver: RECEIVER,
  });

  console.log("Exit plan (in-kind redemption — the always-available V2 exit)");
  console.log(`  signed:              false`);
  console.log(`  liveTransactionSent: false`);
  console.log(`  summary:  ${exitPlan.summary}`);
  console.log(`  target:   ${exitPlan.target} (chain ${exitPlan.chainId})`);
  console.log(`  function: ${exitPlan.function}`);
  console.log('  fallback: for a USDG-only exit, prepareVaultWithdrawal({ ..., mode: "queue_usdg" })');
  console.log("            queues a redemption that settles at the epoch clearing rate.");
}

main().catch((err) => {
  console.error("Example failed (state unknown — nothing was signed or sent):", err);
  process.exit(1);
});
