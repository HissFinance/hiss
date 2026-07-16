import { bpsToPercent } from "../internal/format";
import type { VaultHolding } from "../types";

export type VaultAllocationProps = {
  holdings: VaultHolding[];
  className?: string;
  /** Heading text for the accessible label. */
  title?: string;
};

/**
 * Renders target weights as accessible labelled bars. Weights are shown in
 * basis points as provided; this component does not normalise or invent
 * weights. Bar width reflects each holding's share of the total weight.
 */
export function VaultAllocation({ holdings, className, title = "Vault allocation" }: VaultAllocationProps) {
  if (holdings.length === 0) {
    return (
      <div className={["hiss-card", className].filter(Boolean).join(" ")}>
        <span className="hiss-muted">No allocation data.</span>
      </div>
    );
  }
  const totalBps = holdings.reduce((s, h) => s + h.weightBps, 0) || 1;
  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")} role="list" aria-label={title}>
      {holdings.map((h) => {
        const widthPct = Math.max(0, Math.min(100, (h.weightBps / totalBps) * 100));
        return (
          <div className="hiss-alloc__row" role="listitem" key={h.symbol}>
            <span className="hiss-mono">{h.symbol}</span>
            <div
              className="hiss-alloc__track"
              role="meter"
              aria-valuenow={h.weightBps}
              aria-valuemin={0}
              aria-valuemax={10000}
              aria-label={`${h.symbol} target weight`}
            >
              <div className="hiss-alloc__fill" style={{ width: `${widthPct}%` }} />
            </div>
            <span className="hiss-mono hiss-muted">{bpsToPercent(h.weightBps)}</span>
          </div>
        );
      })}
    </div>
  );
}
