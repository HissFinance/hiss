/**
 * Declarative view blocks — the opt-in mechanism for rich components.
 *
 * ARCHITECTURE (ARCHITECTURE_AUDIT §4): command handlers stay PURE and carry
 * NO color/width logic. A handler attaches a declarative `view: ViewBlock[]` to
 * its {@link CommandResult}; the renderer (Agent 2) turns those data-only
 * blocks into styled, width-aware strings using the component functions. When
 * `view` is absent the renderer falls back to the legacy `summary` + `detail`
 * lines, so existing commands keep working unchanged.
 *
 * JSON mode ignores `view` entirely (it serializes `data`), so the rich blocks
 * never affect the machine contract.
 */

/** Lifecycle / verdict states a status badge can express (each has a symbol). */
export type StateToken =
  | "live"
  | "active"
  | "ready"
  | "prepared"
  | "submitted"
  | "confirmed"
  | "reconciled"
  | "degraded"
  | "blocked"
  | "paused"
  | "stopped"
  | "paper"
  | "demo"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "unknown";

/** A label/value pair for the key-value grid. */
export interface KVRow {
  label: string;
  /** `null`/`undefined` renders an explicit muted UNKNOWN. */
  value: string | number | null | undefined;
  /** Optional semantic token to color the value (state validity, not P&L). */
  token?: StateToken | "address" | "hash" | "muted" | "value";
  /** When true, a 0x value is shown in full (never abbreviated). */
  full?: boolean;
}

export type CellAlign = "left" | "right";

export interface TableColumn {
  header: string;
  align?: CellAlign;
  /** Numeric columns are right-aligned and never wrapped/truncated. */
  numeric?: boolean;
}

/** A table cell: a primitive, or a typed value. `null` → explicit UNKNOWN. */
export type TableCell =
  | string
  | number
  | null
  | undefined
  | {
      value: string | number | null | undefined;
      token?: StateToken | "address" | "hash" | "muted";
      full?: boolean;
    };

export type PanelVariant = "info" | "warning" | "error" | "success" | "evidence" | "review";

export interface TransactionField {
  label: string;
  value: string;
}

export type ReceiptStage = "preparation" | "submission" | "settlement" | "reconciliation";

export interface FuseRow {
  fuse: string;
  result: "pass" | "fail" | "tripped" | "unknown";
  current?: string | number | null;
  limit?: string | number | null;
  reason?: string;
  /** e.g. "2m ago" — freshness of the evidence backing the check. */
  evidenceAge?: string;
}

export interface PnlLine {
  label: string;
  /** Decimal string (precision-safe). Sign is shown; never hidden. */
  amount: string;
  /** Marks the emphasized NET line (must not be dominated by gross). */
  net?: boolean;
  unit?: string;
}

export interface EvidenceRef {
  source?: string;
  block?: string | number | null;
  observedAt?: string;
  hash?: string;
  age?: string;
  note?: string;
}

/** The declarative block union. */
export type ViewBlock =
  | { kind: "text"; lines: string[]; token?: "muted" | "value" | "warning" | "error" | "info" }
  | { kind: "divider" }
  | { kind: "banner"; title: string; subtitle?: string }
  | { kind: "section"; title: string; blocks: ViewBlock[] }
  | { kind: "keyValue"; rows: KVRow[]; title?: string }
  | { kind: "table"; columns: TableColumn[]; rows: TableCell[][]; title?: string; compact?: boolean }
  | { kind: "status"; state: StateToken; label: string; note?: string }
  | { kind: "panel"; variant: PanelVariant; title?: string; lines: string[] }
  | { kind: "progress"; label: string; ratio: number }
  | {
      kind: "transaction";
      chainId: number | string;
      to: string;
      value?: string;
      functionName?: string;
      decodedArgs?: TransactionField[];
      authority?: string;
      approvals?: string[];
      deadline?: string;
      intentHash?: string;
      evidenceHash?: string;
      /** Always false for HISS — surfaced explicitly as UNSIGNED. */
      signed: boolean;
      note?: string;
    }
  | {
      kind: "receipt";
      stage: ReceiptStage;
      title: string;
      fields: KVRow[];
      /** Only a verified on-chain receipt may render as confirmed. */
      verified?: boolean;
    }
  | { kind: "fuse"; rows: FuseRow[]; title?: string }
  | { kind: "pnl"; lines: PnlLine[]; title?: string }
  | {
      kind: "error";
      code: string;
      message: string;
      component?: string;
      context?: string;
      nextAction?: string;
      /** Whether any transaction was submitted (HISS: always false). */
      submitted?: boolean;
      /** Whether funds were affected (HISS: always false). */
      fundsAffected?: boolean;
      docCommand?: string;
    }
  | { kind: "evidence"; refs: EvidenceRef[]; title?: string };
