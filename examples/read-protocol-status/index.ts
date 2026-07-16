/**
 * read-protocol-status — read the chain config and contract directory.
 *
 * This is a read-only example. It never signs or sends a transaction.
 */
import { createHissClient } from "@hiss-finance/sdk";

async function main() {
  const client = createHissClient({
    // Falls back to the public Robinhood Chain RPC when HISS_RPC_URL is unset.
    rpcUrl: process.env.HISS_RPC_URL,
  });

  const status = await client.getStatus();

  console.log(`Network:  ${status.network} (chain ${status.chainId})`);
  console.log(`Read:     ${status.provenance.status}`);
  console.log("Contracts:");
  for (const c of status.contracts) {
    console.log(`  - ${c.name.padEnd(18)} ${c.address}  [${c.status}]`);
  }
}

main().catch((err) => {
  console.error("Read failed (protocol status unknown):", err);
  process.exit(1);
});
