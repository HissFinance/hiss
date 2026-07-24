# Receipts (deterministic, replayable)

Every prepared and executed action carries a deterministic receipt. Recompute the
hash; a receipt that does not verify does not count. Status is proof-derived only.

## Lifecycle (`lp-adapter/receipts.ts`)

| Receipt        | Proves                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| compile        | The ladder/plan compiled deterministically from evidence.                                |
| preparation    | A typed UNSIGNED position package was prepared. Prepare-only evidence — never execution. |
| authorization  | The user's bounded authorization for the package.                                        |
| submission     | The user submitted the package from their own account.                                   |
| settlement     | The on-chain result was observed.                                                        |
| reconciliation | The submitted package reconciles to the on-chain receipt.                                |

## Rules

- A compile or preparation receipt is prepare-only evidence and NEVER proves a
  trade executed. It carries no execution claim.
- Settlement is proven ONLY by the reconciled on-chain receipt. Until then a
  position is `UNRECONCILED` — shown as "not yet proven on-chain, not settled,"
  never as settled.
- Receipts are deterministic: the same evidence recomputes the same hash
  (`evidenceFingerprint`). Verify with `hiss_lp_verify_receipt`; a receipt whose
  recomputed hash does not match "Does not match" and does not count.
- Reconciliation is by receipt lineage, never a blind retry. If a submission is
  unconfirmed, reconcile first; retry only after reconciliation, never
  automatically.
