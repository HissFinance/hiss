/**
 * read-flagship-vault — read the flagship vault's summary and holdings.
 *
 * Read-only. Depositing into a vault is NOT direct ownership of the underlying
 * securities, and deposit availability is a live on-chain read.
 */
import { createHissClient, HISS_ADDRESSES } from "@hiss-finance/sdk";

async function main() {
  const client = createHissClient({ rpcUrl: process.env.HISS_RPC_URL });

  const vault = await client.getVault(HISS_ADDRESSES.flagshipVault);

  console.log(`Vault:    ${vault.name}`);
  console.log(`Address:  ${vault.address} (chain ${vault.chainId})`);
  console.log(`Asset:    ${vault.assetSymbol ?? "unknown"}`);
  console.log(`Deposits: ${vault.depositState}`);
  console.log(`Read:     ${vault.provenance.status}`);

  const holdings = vault.holdings ?? (await client.getVaultHoldings(vault.address));
  if (holdings.length === 0) {
    console.log("Holdings: none reported");
  } else {
    console.log("Holdings (target weights):");
    for (const h of holdings) {
      console.log(`  - ${h.symbol.padEnd(8)} ${(h.weightBps / 100).toFixed(2)}%`);
    }
  }
}

main().catch((err) => {
  console.error("Read failed (vault state unknown):", err);
  process.exit(1);
});
