# Example — monitor, collect, and withdraw

**User:** "How's my position doing, and how do I get out?"

**Agent flow (read + prepare-only):**

1. `hiss_lp_position_read` → live position state: fill progress, fuse status, and
   net P&L marked at the real price (fees shown beside the signed net).
2. If the position has not reconciled to an on-chain receipt, show `UNRECONCILED`
   ("not yet proven on-chain, not settled") — never "settled."
3. To take fees: prepare a typed unsigned `collect` package
   (`hiss_lp_prepare_collect`). To exit: prepare a typed unsigned withdrawal /
   close (`hiss_lp_prepare_withdraw` / `hiss_lp_prepare_close`). Exits are always
   reachable even when a fuse HALTs new positions.
4. The user authorizes and submits each package in their own account. Reconcile the
   on-chain receipt (`hiss_lp_verify_receipt`) afterward; retry only after
   reconciliation, never automatically.

**Good answer shape:**

> Live position — net P&L marked at the real price: **−$X** (fees $Y). It is
> UNRECONCILED for the last action: not yet proven on-chain, not settled. To exit,
> here is a typed unsigned close package you submit in your own account; withdrawal
> stays available even though a fuse is currently HALTing new positions. Your funds
> are unchanged while paused.

**Never:** claim a settlement without a reconciled receipt, auto-retry a submission,
or imply the position earns yield.
