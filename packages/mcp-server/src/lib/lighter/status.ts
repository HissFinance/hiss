/**
 * Lighter rail — honest capability status ladder (§16).
 *
 * The ladder is monotonic: READ ⊂ PREPARE ⊂ PAPER ⊂ USER_AUTHORIZED_LIVE. HISS
 * may only advertise the rung it has ACTUALLY completed + tested. This constant
 * is the single source of truth for what HISS surfaces (homepage, docs, MCP)
 * may claim about Lighter.
 *
 * CURRENT RUNG: PREPARE.
 *   - READ  ✓ public market data (markets, orderbook, mid/spread/depth, trades).
 *   - PREPARE ✓ typed unsigned order/cancel/modify intents with a risk envelope.
 *   - PAPER  ✗ not built (no paper fill/inventory simulator yet).
 *   - USER_AUTHORIZED_LIVE ✗ requires a user-controlled local signer; HISS never
 *     signs. Live market making additionally requires nonce management, fills,
 *     inventory/velocity/loss/stale-book fuses, WS recovery, and
 *     cancel-on-disconnect — none of which HISS operates.
 *
 * HARD BOUNDARY: the hosted HISS service holds no Lighter API private key, auth
 * token, user nonce, or unrestricted order authority. Advancing this rung
 * requires the user's local runtime, not a HISS deployment.
 */

export type LighterRailRung = "READ" | "PREPARE" | "PAPER" | "USER_AUTHORIZED_LIVE";

export interface LighterRailCapability {
  rung: LighterRailRung;
  implemented: boolean;
  tested: boolean;
  note: string;
}

export const LIGHTER_RAIL_LADDER: readonly LighterRailCapability[] = [
  {
    rung: "READ",
    implemented: true,
    tested: true,
    note: "Public market data: market list + stock-token classification, orderbook normalization (bid/ask/mid/spread/depth), recent trades. Fail-closed to DEGRADED; UNKNOWN on empty books.",
  },
  {
    rung: "PREPARE",
    implemented: true,
    tested: true,
    note: "Typed UNSIGNED order/cancel/modify intents with precision-scaled integers, expiry-bound validation, partner attribution fields, HISS risk envelope, and a deterministic intent hash. signed:false, no key ever.",
  },
  {
    rung: "PAPER",
    implemented: false,
    tested: false,
    note: "Not built. Would simulate fills + inventory/P&L against live books without touching Lighter.",
  },
  {
    rung: "USER_AUTHORIZED_LIVE",
    implemented: false,
    tested: false,
    note: "Never a HISS-hosted capability. Requires the user's local signer (official Python/Go SDK), nonce management, fills, inventory/velocity/loss/stale-book fuses, WS recovery, and cancel-on-disconnect.",
  },
] as const;

/** The highest rung HISS has actually implemented AND tested. */
export const LIGHTER_CURRENT_RUNG: LighterRailRung = "PREPARE";

export function lighterRailStatus(): {
  currentRung: LighterRailRung;
  ladder: readonly LighterRailCapability[];
  hostedHoldsKeys: false;
  stockTokenMarketsExist: true;
} {
  return {
    currentRung: LIGHTER_CURRENT_RUNG,
    ladder: LIGHTER_RAIL_LADDER,
    hostedHoldsKeys: false,
    stockTokenMarketsExist: true,
  };
}
