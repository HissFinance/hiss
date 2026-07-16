import type { ReactNode } from "react";
import { XHISS_COPY, XHISS_TIMING } from "../constants";
import { formatBaseUnits } from "../internal/format";
import type { XhissPosition } from "../types";
import { HissStatusBadge } from "./HissStatusBadge";

export type StakePanelProps = {
  /** Current position, when known. */
  position?: XhissPosition;
  /**
   * Slot for your own staking form / plan review (e.g. `<ActionPlanReview />`).
   * This component is headless about how staking is initiated.
   */
  children?: ReactNode;
  className?: string;
};

/**
 * A composable staking panel. It renders the approved, mechanical xHISS copy
 * verbatim (never a yield or income claim) and the caller's current position,
 * and leaves the action UI to `children`. It does not initiate staking.
 */
export function StakePanel({ position, children, className }: StakePanelProps) {
  const shares = position != null ? formatBaseUnits(position.shareBaseUnits, 18) : null;

  return (
    <section className={["hiss-card", className].filter(Boolean).join(" ")} aria-label="Stake HISS">
      <div className="hiss-row" style={{ justifyContent: "space-between" }}>
        <strong>
          {XHISS_TIMING.shareName} ({XHISS_TIMING.shareSymbol})
        </strong>
        {position ? <HissStatusBadge status={position.provenance.status} /> : null}
      </div>

      <p>{XHISS_COPY.headline}</p>

      {position ? (
        <div className="hiss-row">
          <span className="hiss-muted">Your {XHISS_TIMING.shareSymbol}</span>
          <span className="hiss-mono">{shares}</span>
          {position.shareRate ? (
            <span className="hiss-muted">
              @ {position.shareRate} HISS/{XHISS_TIMING.shareSymbol}
            </span>
          ) : null}
        </div>
      ) : null}

      {children}

      <p className="hiss-plan__note">{XHISS_COPY.exitNote}</p>
      <p className="hiss-plan__note">
        <strong>{XHISS_COPY.disclaimer}</strong> {XHISS_COPY.historicalNote}
      </p>
    </section>
  );
}
