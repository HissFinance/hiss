/**
 * Display-only formatting helpers. These never round in a way that inflates a
 * value and never invent precision — base-unit strings are the source of truth.
 */

/** Truncate an address as `0x1234…abcd` for compact display. */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (!address.startsWith("0x") || address.length <= lead + tail) {
    return address;
  }
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Format a base-unit integer string as a human-readable decimal string with
 * `decimals` fractional digits, trimming trailing zeros. Pure string math — no
 * float conversion, so large token amounts stay exact.
 */
export function formatBaseUnits(amountBaseUnits: string, decimals: number, maxFractionDigits = 6): string {
  if (!/^\d+$/.test(amountBaseUnits)) return amountBaseUnits;
  const negative = false; // base-unit strings here are non-negative
  const padded = amountBaseUnits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals) || "0";
  let fraction = decimals > 0 ? padded.slice(padded.length - decimals) : "";
  if (maxFractionDigits >= 0) fraction = fraction.slice(0, maxFractionDigits);
  fraction = fraction.replace(/0+$/, "");
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fraction ? `${wholeGrouped}.${fraction}` : wholeGrouped;
  return negative ? `-${body}` : body;
}

/** Basis points → percentage string, e.g. 2500 → "25%". */
export function bpsToPercent(bps: number, maxFractionDigits = 2): string {
  const pct = bps / 100;
  return `${Number(pct.toFixed(maxFractionDigits))}%`;
}

/** Format a duration in seconds as e.g. "72h 0m" / "2d 0h". */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
