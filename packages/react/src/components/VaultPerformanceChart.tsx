import { useId } from "react";
import type { PerformancePoint } from "../types";

export type VaultPerformanceChartProps = {
  points: PerformancePoint[];
  width?: number;
  height?: number;
  className?: string;
  /** Accessible label describing what the series represents. */
  ariaLabel?: string;
  /** Text shown when there is no observed history. */
  emptyLabel?: string;
};

/**
 * A minimal, dependency-free SVG line/area chart of observed performance
 * points. It renders ONLY the data you pass — an empty series shows an honest
 * "no data" message rather than a flat or fabricated line. Numbers are parsed
 * from the base decimal strings for geometry only.
 */
export function VaultPerformanceChart({
  points,
  width = 320,
  height = 120,
  className,
  ariaLabel = "Vault performance over time",
  emptyLabel = "No performance history available.",
}: VaultPerformanceChartProps) {
  const titleId = useId();
  const gradId = useId();

  const values = points.map((p) => Number(p.value)).filter((n) => Number.isFinite(n));

  if (points.length < 2 || values.length < 2) {
    return (
      <div className={["hiss-card", className].filter(Boolean).join(" ")}>
        <span className="hiss-chart__empty">{emptyLabel}</span>
      </div>
    );
  }

  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);

  const coords = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${coords[coords.length - 1]![0].toFixed(2)},${height - pad} ` +
    `L${coords[0]![0].toFixed(2)},${height - pad} Z`;

  const first = values[0]!;
  const last = values[values.length - 1]!;

  return (
    <figure className={["hiss-card", className].filter(Boolean).join(" ")} style={{ margin: 0 }}>
      <svg
        className="hiss-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="none"
      >
        <title id={titleId}>
          {ariaLabel}. {values.length} points, from {first} to {last}.
        </title>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hiss-chart-fill)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--hiss-chart-stroke)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </figure>
  );
}
