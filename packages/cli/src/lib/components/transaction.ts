/**
 * TRANSACTION REVIEW (task §13): the unsigned-payload review. HISS prepares,
 * never sends, so `signed` is always false and the review states UNSIGNED
 * prominently. CRITICAL: values inside a signed-payload review are shown in
 * FULL — addresses, hashes, and calldata are NEVER abbreviated here (§13), so a
 * signer reviews exactly what they would submit.
 */

import type { OutputContext } from "../context.js";
import type { KVRow } from "../view.js";
import { renderKeyValue } from "./key-value.js";
import { renderStatus } from "./status.js";

export interface TransactionProps {
  chainId: number | string;
  to: string;
  value?: string;
  functionName?: string;
  decodedArgs?: { label: string; value: string }[];
  authority?: string;
  approvals?: string[];
  deadline?: string;
  intentHash?: string;
  evidenceHash?: string;
  signed: boolean;
  note?: string;
}

export function renderTransaction(ctx: OutputContext, props: TransactionProps): string[] {
  const out: string[] = [];
  out.push(ctx.theme.heading("Transaction review"));

  // Signed state — always explicit, never styled as a completed action.
  out.push(
    ...renderStatus(ctx, {
      state: props.signed ? "submitted" : "prepared",
      label: props.signed ? "SIGNED" : "UNSIGNED",
      note: props.signed ? undefined : "review it, then submit with your own wallet — nothing was sent",
    }),
  );

  // Every value is shown in FULL (full: true) — no abbreviation in a review.
  const rows: KVRow[] = [
    { label: "Chain", value: String(props.chainId) },
    { label: "Target", value: props.to, token: "address", full: true },
  ];
  if (props.functionName) rows.push({ label: "Function", value: props.functionName });
  if (props.authority) rows.push({ label: "Authority", value: props.authority, full: true });
  if (props.value !== undefined) rows.push({ label: "Value", value: `${props.value} wei` });
  for (const arg of props.decodedArgs ?? [])
    rows.push({ label: `  arg ${arg.label}`, value: arg.value, full: true });
  if (props.approvals && props.approvals.length)
    rows.push({ label: "Approvals", value: props.approvals.join(", ") });
  if (props.deadline) rows.push({ label: "Deadline", value: props.deadline });
  if (props.intentHash)
    rows.push({ label: "Intent hash", value: props.intentHash, token: "hash", full: true });
  if (props.evidenceHash)
    rows.push({ label: "Evidence hash", value: props.evidenceHash, token: "hash", full: true });

  out.push(...renderKeyValue(ctx, { rows }));
  if (props.note) out.push(ctx.theme.muted(props.note));
  return out;
}
