/**
 * RECEIPT VIEW (task §13): renders a receipt at one of four DISTINCT stages —
 * PREPARATION · SUBMISSION · SETTLEMENT · RECONCILIATION. CRITICAL: a
 * preparation receipt is NEVER styled as confirmed execution. Only a stage of
 * settlement/reconciliation WITH `verified` true may use the confirmed/success
 * styling; everything else renders as prepared/pending/muted.
 */

import type { OutputContext } from "../context.js";
import type { KVRow, ReceiptStage, StateToken } from "../view.js";
import { renderKeyValue } from "./key-value.js";
import { renderStatus } from "./status.js";

const STAGE_LABEL: Record<ReceiptStage, string> = {
  preparation: "PREPARATION",
  submission: "SUBMISSION",
  settlement: "SETTLEMENT",
  reconciliation: "RECONCILIATION",
};

function stageState(stage: ReceiptStage, verified: boolean): StateToken {
  switch (stage) {
    case "preparation":
      return "prepared"; // never confirmed
    case "submission":
      return "submitted";
    case "settlement":
      return verified ? "confirmed" : "submitted";
    case "reconciliation":
      return verified ? "reconciled" : "degraded";
  }
}

export function renderReceipt(
  ctx: OutputContext,
  props: { stage: ReceiptStage; title: string; fields: KVRow[]; verified?: boolean },
): string[] {
  const verified = props.verified === true;
  const out: string[] = [];
  out.push(ctx.theme.heading(props.title));
  out.push(
    ...renderStatus(ctx, {
      state: stageState(props.stage, verified),
      label: STAGE_LABEL[props.stage],
      note: props.stage === "preparation" ? "prepared only — not an executed action" : undefined,
    }),
  );
  out.push(...renderKeyValue(ctx, { rows: props.fields }));
  return out;
}
