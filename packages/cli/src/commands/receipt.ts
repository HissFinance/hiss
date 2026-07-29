/**
 * `hiss receipt verify <receipt>` — verify a receipt's integrity hash. This
 * proves the receipt is internally consistent; it does NOT assert that any
 * transaction was executed unless the receipt itself carries on-chain proof.
 */

import { readFile } from "node:fs/promises";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { ViewBlock } from "../lib/view.js";
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

  const view: ViewBlock[] = [];
  if (result.ok) {
    // Integrity is proven; settlement is shown ONLY when on-chain proof exists.
    // A stage without proof is never styled as confirmed.
    view.push({
      kind: "receipt",
      stage: "preparation",
      title: "Integrity",
      verified: true,
      fields: [{ label: "Canonical hash", value: result.computedHash, token: "hash", full: true }],
    });
    if (result.onchainConfirmed) {
      view.push({
        kind: "receipt",
        stage: "settlement",
        title: "Settlement",
        verified: true,
        fields: [
          { label: "Proof", value: "on-chain confirmed (onchainConfirmed + txHash)", token: "confirmed" },
        ],
      });
    } else {
      view.push({
        kind: "panel",
        variant: "info",
        lines: [
          "No on-chain proof attached — this is an integrity record, not settlement. No later stage is implied.",
        ],
      });
    }
  } else {
    view.push({ kind: "status", state: "error", label: `FAILED — ${result.issues.length} issue(s)` });
    view.push({ kind: "panel", variant: "error", title: "Verification issues", lines: result.issues });
  }

  return {
    summary: result.ok
      ? `Receipt integrity VERIFIED${result.onchainConfirmed ? " (on-chain confirmed)" : ""}.`
      : `Receipt verification FAILED: ${result.issues.length} issue(s).`,
    data: result,
    detail,
    view,
    // Only relax the output guard when the receipt actually proves settlement.
    receiptVerified: result.onchainConfirmed,
    exitCode: result.ok ? EXIT.SUCCESS : EXIT.VERIFICATION,
  };
}
