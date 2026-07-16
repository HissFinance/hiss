// SPDX-License-Identifier: Apache-2.0
/**
 * Pure bigint helpers for reward allocation. Floor division throughout; no
 * floats. Dust (the remainder from floor division) is returned to the caller
 * so nothing is silently minted or lost.
 */

/** Parse a non-negative base-unit decimal string to bigint. */
export function toBase(label: string, value: string): bigint {
  if (!/^\d+$/.test(value))
    throw new Error(`${label} must be a non-negative base-unit decimal string, got: ${value}`);
  return BigInt(value);
}

/**
 * Pro-rata split of `pool` across `weights` by weight, floor division. Returns
 * one amount per weight (aligned to input order) plus the undistributed dust.
 */
export function proRata(pool: bigint, weights: readonly bigint[]): { amounts: bigint[]; dust: bigint } {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0n);
  if (totalWeight <= 0n) {
    return { amounts: weights.map(() => 0n), dust: pool };
  }
  const amounts = weights.map((w) => (pool * w) / totalWeight);
  const distributed = amounts.reduce((sum, a) => sum + a, 0n);
  return { amounts, dust: pool - distributed };
}

/**
 * Apply a per-recipient cap to `raw` amounts, redistributing the overflow to
 * under-cap recipients by their remaining headroom (water-fill). Anything that
 * cannot be placed under the cap is returned as `unplaceable`.
 */
export function waterfillCap(
  raw: readonly bigint[],
  capPerRecipient: bigint,
): { capped: bigint[]; unplaceable: bigint } {
  const capped = raw.map((amount) => (amount > capPerRecipient ? capPerRecipient : amount));
  let overflow = raw.reduce((sum, amount, i) => sum + (amount - capped[i]!), 0n);

  // Iteratively fill headroom of under-cap recipients until nothing moves.
  let moved = true;
  while (overflow > 0n && moved) {
    moved = false;
    const headroom = capped.map((amount) => capPerRecipient - amount);
    const totalHeadroom = headroom.reduce((sum, h) => sum + h, 0n);
    if (totalHeadroom <= 0n) break;
    const { amounts: add, dust } = proRata(overflow, headroom);
    for (let i = 0; i < capped.length; i++) {
      const grant = add[i]! > headroom[i]! ? headroom[i]! : add[i]!;
      if (grant > 0n) {
        capped[i]! += grant;
        moved = true;
      }
    }
    const placed = add.reduce((sum, a, i) => sum + (a > headroom[i]! ? headroom[i]! : a), 0n);
    overflow = overflow - placed;
    if (dust > 0n && !moved) break;
  }

  return { capped, unplaceable: overflow };
}
