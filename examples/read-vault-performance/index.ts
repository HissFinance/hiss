/**
 * read-vault-performance — read a vault's observed performance series.
 *
 * Past performance is not a forecast. When there is no observed history the
 * example prints an honest "no data" message — it never fabricates a series.
 */
import { createHissClient, HISS_ADDRESSES } from "@hiss-finance/sdk";

async function main() {
  const client = createHissClient({ rpcUrl: process.env.HISS_RPC_URL });

  const perf = await client.getVaultPerformance(HISS_ADDRESSES.flagshipVault);

  console.log(`Vault:  ${perf.address}`);
  console.log(`Read:   ${perf.provenance.status}`);

  if (perf.points.length < 2) {
    console.log("Performance: no observed history available (not a flat line — simply no data).");
    return;
  }

  const first = perf.points[0]!;
  const last = perf.points[perf.points.length - 1]!;
  console.log(`Points: ${perf.points.length}`);
  console.log(`First:  ${first.at} -> ${first.value}`);
  console.log(`Last:   ${last.at} -> ${last.value}`);
  console.log("Note: past performance is not a forecast.");
}

main().catch((err) => {
  console.error("Read failed (performance unknown):", err);
  process.exit(1);
});
