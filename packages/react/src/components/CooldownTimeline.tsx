import { XHISS_TIMING } from "../constants";
import { formatDuration } from "../internal/format";

export type CooldownTimelineProps = {
  /** Unix seconds when cooldown completes / redeem window opens. */
  cooldownEndsAt?: number;
  /** Unix seconds when the redeem window closes. */
  redeemWindowEndsAt?: number;
  /** Current time, unix seconds. Defaults to now. */
  nowSeconds?: number;
  className?: string;
};

type Phase = "staked" | "cooling" | "redeemable" | "expired";

function phaseOf(now: number, endsAt?: number, windowEnds?: number): Phase {
  if (endsAt == null) return "staked";
  if (now < endsAt) return "cooling";
  if (windowEnds != null && now <= windowEnds) return "redeemable";
  if (windowEnds != null && now > windowEnds) return "expired";
  return "redeemable";
}

/**
 * Visualises the xHISS exit path: cooldown → redeem window. Timing constants
 * are the immutable contract values (72h cooldown, 2-day window). Shows the
 * current phase from the provided timestamps; does not assume a position.
 */
export function CooldownTimeline({
  cooldownEndsAt,
  redeemWindowEndsAt,
  nowSeconds,
  className,
}: CooldownTimelineProps) {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const phase = phaseOf(now, cooldownEndsAt, redeemWindowEndsAt);

  const steps: Array<{ key: Phase; label: string; detail: string }> = [
    {
      key: "cooling",
      label: `Cooldown (${formatDuration(XHISS_TIMING.cooldownSeconds)})`,
      detail:
        cooldownEndsAt == null
          ? "Not started."
          : phase === "cooling"
            ? `Opens in ${formatDuration(cooldownEndsAt - now)}.`
            : "Complete.",
    },
    {
      key: "redeemable",
      label: `Redeem window (${formatDuration(XHISS_TIMING.redeemWindowSeconds)})`,
      detail:
        phase === "redeemable" && redeemWindowEndsAt != null
          ? `Closes in ${formatDuration(redeemWindowEndsAt - now)}.`
          : phase === "expired"
            ? "Missed — restart cooldown to redeem again."
            : "Opens after cooldown completes.",
    },
  ];

  const nodeClass = (key: Phase): string => {
    if (key === "cooling") {
      return phase === "cooling"
        ? "hiss-timeline__node--active"
        : cooldownEndsAt != null
          ? "hiss-timeline__node--done"
          : "";
    }
    if (phase === "redeemable") return "hiss-timeline__node--active";
    return "";
  };

  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")}>
      <div className="hiss-timeline" role="list" aria-label="xHISS exit timeline">
        {steps.map((s) => (
          <div className="hiss-timeline__step" role="listitem" key={s.key}>
            <span
              className={["hiss-timeline__node", nodeClass(s.key)].filter(Boolean).join(" ")}
              aria-hidden="true"
            />
            <span>
              <strong>{s.label}</strong>
              <br />
              <span className="hiss-muted">{s.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
