# Strategy updates

A creator can evolve a vault's strategy, but not silently. Changes go through a
**disclosed notice period** and update the manifest's version and hash so depositors can
see exactly what changed and when.

## The notice period

- Strategy changes require a disclosed notice period — **7 days** (`604800` seconds) in
  the flagship vault's `creatorPolicy.strategyNoticePeriodSeconds`.
- During the notice window, the pending change is public. Depositors who disagree can
  [withdraw](./withdraw.md) before it takes effect.
- After the window, the change may be applied, producing a [receipt](../receipts.md).

## What a strategy update can change

- **Target weights** ([allocations](./allocations.md)) — within the vault's
  [risk fuses](./risk-fuses.md).
- **Allowed assets** — additions/removals from `allowedAssetSymbols` (canonical
  addresses only).
- **Rebalance policy** parameters — within enforced bounds.

Each change bumps `strategyVersion` and updates `strategyDescriptionHash` and the
manifest hash. A different hash is how tooling and depositors detect the change.

## What it cannot do

- It cannot bypass risk fuses, exceed fee caps, or remove disclosed protections.
- It cannot retroactively change fees already crystallized.
- It cannot take custody or execute — applying a change still happens within the
  contract's rules, and any resulting rebalance is compiled, validated, and audited.

## Fees are still capped

An update cannot push the performance fee above its cap (10% unverified / 20%
verified) or the protocol share above 20%. Fee changes are disclosed like everything
else. See [Vault fees](../fees/vault-fees.md).

## Recommended flow

1. **Compose** the new manifest version with `@hiss-finance/vault-kit`; validate fuses
   and fees.
2. **Announce** the change (start the notice period) — a disclosed, public pending
   state.
3. **Wait** out the notice window; depositors can exit.
4. **Apply** after the window; a receipt records the new `strategyVersion` and hash.
5. **Rebalance** (if needed) toward the new targets via [CoilOps](../coilops.md), with
   a post-run audit.

## Honesty

Strategy history is auditable through versioned manifests, hashes, and receipts.
Nothing about a strategy update implies a return; **no guaranteed yield**, and a new
strategy is not a performance claim.
