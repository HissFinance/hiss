import { bpsToPercent, truncateAddress } from "../internal/format";
import type { RewardLeg, RewardLegState } from "../types";

export type RewardLifecycleProps = {
  legs: RewardLeg[];
  className?: string;
  title?: string;
};

const STATE_LABEL: Record<RewardLegState, string> = {
  planned: "Planned",
  funded: "Funded",
  claimable: "Claimable",
  none: "Not deployed",
};

/**
 * Renders reward-split legs and their lifecycle state. It never conflates
 * planned/funded/claimable, and shows a `null` recipient honestly as "not
 * deployed" — nothing moves against an undeployed distributor.
 */
export function RewardLifecycle({ legs, className, title = "Reward split" }: RewardLifecycleProps) {
  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")} role="table" aria-label={title}>
      {legs.map((leg) => (
        <div className="hiss-row" role="row" key={leg.name} style={{ justifyContent: "space-between" }}>
          <span role="cell">
            <strong>{leg.name}</strong> <span className="hiss-muted">{bpsToPercent(leg.bps)}</span>
          </span>
          <span role="cell" className="hiss-row">
            <span className="hiss-mono hiss-muted">
              {leg.recipient ? truncateAddress(leg.recipient) : "no recipient"}
            </span>
            <span
              className={[
                "hiss-badge",
                leg.state === "claimable" || leg.state === "funded"
                  ? "hiss-badge--live"
                  : leg.state === "planned"
                    ? "hiss-badge--degraded"
                    : "hiss-badge--unknown",
              ].join(" ")}
            >
              {STATE_LABEL[leg.state]}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
