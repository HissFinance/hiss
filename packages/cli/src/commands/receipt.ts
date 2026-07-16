/**
 * `hiss receipt verify <receipt>` — verify a receipt's integrity hash. This
 * proves the receipt is internally consistent; it does NOT assert that any
 * transaction was executed unless the receipt itself carries on-chain proof.
 */

import { readFile } from "node:fs/promises";
import type { CommandResult } from "../lib/output.js";
import { verifyReceipt } from "../lib/receipt.js";

async function loadReceipt(pathOrJson: string): Promise<unknown> {
  const trimmed = pathOrJson.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as unknown;
  const raw = await readFile(pathOrJson, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function receiptVerifyCommand(receiptArg: string): Promise<CommandResult> {
  const receipt = await loadReceipt(receiptArg);
  const result = verifyReceipt(receipt);
  const detail: string[] = [];
  if (result.ok) {
    detail.push(`Integrity OK — canonical hash ${result.computedHash}.`);
    detail.push(
      result.onchainConfirmed
        ? "Receipt carries on-chain proof (onchainConfirmed + txHash)."
        : "No on-chain proof attached — this receipt is an integrity record, not settlement.",
    );
  } else {
    detail.push(...result.issues);
  }
  return {
    summary: result.ok
      ? `Receipt integrity VERIFIED${result.onchainConfirmed ? " (on-chain confirmed)" : ""}.`
      : `Receipt verification FAILED: ${result.issues.length} issue(s).`,
    data: result,
    detail,
    // Only relax the output guard when the receipt actually proves settlement.
    receiptVerified: result.onchainConfirmed,
  };
}
