import type { ReadStatus } from "../types";

const LABELS: Record<ReadStatus, string> = {
  live: "Live",
  degraded: "Degraded",
  unknown: "Unknown",
};

export type HissStatusBadgeProps = {
  status: ReadStatus;
  /** Override the visible label. */
  label?: string;
  className?: string;
};

/**
 * A small, accessible status pill. Colour is driven by `--hiss-status-*` CSS
 * variables. A failed read is `unknown` — never render it as `live`.
 */
export function HissStatusBadge({ status, label, className }: HissStatusBadgeProps) {
  const text = label ?? LABELS[status];
  return (
    <span
      className={["hiss-badge", `hiss-badge--${status}`, className].filter(Boolean).join(" ")}
      role="status"
      aria-label={`Status: ${text}`}
    >
      <span className="hiss-badge__dot" aria-hidden="true" />
      {text}
    </span>
  );
}
