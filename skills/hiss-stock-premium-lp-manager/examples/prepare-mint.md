# Example — prepare a typed unsigned LP mint

**User:** "Prepare an LP mint for that ladder that I can authorize in my own Safe."

**Agent flow (prepare-only — HISS signs nothing):**

1. Re-confirm the ladder at posture `PREPARE_ONLY` and the amount-aware premium is
   within capacity (not `OVER_CAPACITY`/`UNKNOWN`/`HALTED`).
2. Evaluate the fuses. If any returns `HALT`, or the jurisdiction gate is FALSE,
   REFUSE (fail-closed) and surface the reason — do not prepare.
3. Compile the typed LP intent (`mint`) through the typed
   `NonfungiblePositionManager` adapter — only the pinned NPM entrypoints plus an
   exact ERC-20 approve (never an unbounded approval, never arbitrary calldata).
4. Produce the Signature Review payload: target = the typed LP adapter on chain
   4663, the calldata hash, and the individually checked acknowledgments (fees are
   not profit / unhedged falling-knife / thin single-venue / premium may not
   converge). Emit the compile + preparation receipts.

**Good answer shape:**

> Here is a typed, UNSIGNED mint package. HISS does not sign or submit — you
> authorize and submit it in your own Safe. Target: the typed LP adapter on chain 4663. Calldata hash: `0x…`. It uses only the pinned position-manager entrypoints
> and an exact approve. Please confirm the four acknowledgments in Signature
> Review, then submit from your Safe. I'll reconcile the on-chain receipt after.

**Never:** output a signed transaction, a private key, a Bankr API key, arbitrary
calldata, an unbounded approval, or the word "Execute." Never say the position is
live before the on-chain receipt reconciles.
