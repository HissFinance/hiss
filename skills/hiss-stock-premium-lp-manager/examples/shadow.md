# Example — shadow ladder + eight-line accounting

**User:** "Build a USDG buy ladder below GME's pool price and show what it actually
nets — not just the fees."

**Agent flow (simulate, no capital, no transaction):**

1. Read the amount-aware premium point (`USDG_TO_TOKEN`) for the intended notional;
   confirm `confidence` is not `UNKNOWN`/`HALTED` and the size is within capacity.
2. `buildLadder` with template `PREMIUM_USDG_BUY_LADDER`, posture `SHADOW`, a target
   band below pool price; capacity bounded by usable depth.
3. `computePnlBreakdown` → render the eight lines with the **net as the headline**:

   1. Realized LP fees
   2. Realized inventory P&L
   3. Unrealized inventory P&L (marked at the real price)
   4. Gas
   5. Swap costs
   6. Position-management costs
   7. Adverse-selection estimate (labeled estimate)
   8. **Net strategy P&L** ← signed headline

**Good answer shape:**

> Simulated net strategy P&L: **−$1.91** (fees collected: $19.12). Fees are gross;
> the net marks inventory at the real price and is negative here — a positive fee
> figure is not a win. This is a hypothetical illustration of "fees are not
> profit," not HISS or observed data. As price falls through the range your USDG
> converts to GME (unhedged, falling-knife risk); the premium may not converge.

**Never:** show fees without the signed net, style a negative net as positive, or
merge this shadow result into any live total — shadow and live are distinct.
