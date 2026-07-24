/**
 * Prepare fail-closed guard.
 *
 * A prepared UNSIGNED transaction must describe a REAL call. This guard refuses
 * any prepare result that would be a deceptive success shell:
 *   - an empty or zero-address target (a "prepared" tx that sends value/calldata
 *     to nowhere, or worse to the zero address), or
 *   - empty / selector-less calldata (no 4-byte function selector), which would
 *     do nothing yet render as a successful preparation.
 *
 * It is pure and dependency-free so it is unit-testable in isolation and can be
 * reused by any prepare path.
 */

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Real calldata is at minimum a 4-byte selector: "0x" + 8 hex chars.
const CALLDATA_RE = /^0x[0-9a-fA-F]{8,}$/;

/** Throw (fail closed) if a prepared tx has an empty target or empty calldata. */
export function assertRealizableUnsignedTx(to: unknown, data: unknown): void {
  const toStr = typeof to === "string" ? to : "";
  const dataStr = typeof data === "string" ? data : "";
  if (!ADDRESS_RE.test(toStr) || toStr.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`Refusing to return an unsigned tx with an empty/zero target ("${toStr}").`);
  }
  if (!CALLDATA_RE.test(dataStr)) {
    throw new Error(`Refusing to return an unsigned tx with empty / selector-less calldata ("${dataStr}").`);
  }
}
