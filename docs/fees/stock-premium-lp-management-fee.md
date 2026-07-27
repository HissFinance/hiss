# Stock-Premium LP management fee

The management fee for **managed** Stock-Premium LP positions: a **5% charge on
realized LP fees only** — never on principal, never on inventory value, never on
P&L. It is a standalone protocol **service-revenue** stream, routed **100% to the
HISS Treasury Safe**. It is **not** part of the $HISS trading-fee reward split
(50/15/15/10/10) and never funds a reward distributor.

> **Scope.** This fee exists only in the **managed** lifecycle enforced by the
> deployed `HissLpManagerV1` contract. Self-managed positions prepared through the
> [Stock Premium LP skill](../../skills/hiss-stock-premium-lp-manager/SKILL.md) and
> executed by the user's own authority are **not** charged this fee by HISS.

## The fee, in the standard fields

- **Source:** the frozen policy `HISS_LP_MANAGEMENT_FEE_V1` in
  `@hiss-finance/core` (`stock-premium/fee`), enforced on-chain by
  `HissLpManagerV1`.
- **Exact current value:** **500 bps** (5%) of **realized LP fees**, per fee token.
- **Immutable maximum:** **500 bps** — the contract's `MAX_FEE_BPS` is immutable,
  so the fee can never be configured above 5%. Out-of-range values are rejected
  fail-closed, never silently clamped.
- **Version:** `HISS_LP_MANAGEMENT_FEE_V1`.
- **Where verifiable:** read `feeBps()`, `MAX_FEE_BPS()`, `treasury()`, and
  `paused()` on the deployed contract (address below); recompute any split with
  `computeManagementFee` in `@hiss-finance/core`.
- **Contract-enforced vs policy:** contract-enforced. The Solidity arithmetic is
  proven equal to the TypeScript SSOT over committed parity vectors
  (`packages/core/test/fixtures/management-fee-vectors.json`).
- **Example:** a managed position realizes **19.12 USDG** of LP fees (6 decimals:
  `19_120_000`). Protocol fee = `19_120_000 × 500 / 10000 = 956_000` (**0.956
  USDG** to the Treasury Safe); the user keeps `18_164_000` (**18.164 USDG**).
  The two legs always sum exactly to the input.
- **Caveat:** LP fees are **not profit** — inventory value can fall while fees
  accrue. Fee illustrations are static fee math, not forecasts and not
  performance claims.

## Arithmetic properties (contract-mirrored)

`computeManagementFee(realizedLpFeeN, feeBps)` is exact bigint math with these
properties, asserted in tests and mirrored by the contract:

1. **Conservation** — `protocolFee + userFee === realizedLpFee`, always.
2. **Dust favors the user** — the protocol side is floored
   (multiply-before-divide); all division dust stays with the user.
3. **Bounded, fail-closed** — a fee outside `[0, 500]` bps throws; nothing is
   clamped.
4. **Principal isolation** — the function has no principal / inventory / P&L
   parameter; structurally it can only ever charge realized fees.
5. **Per token** — applied independently per fee token; no cross-token netting,
   no forced swap.
6. **Zero-safe** — zero realized fees produce zero on both legs.

## The deployed contract

| Fact                         | Value                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract                     | `HissLpManagerV1`                                                                                                                                  |
| Address (chain 4663)         | `0xBE5989a38953D8148B74d45eE6DEB127a32567E0`                                                                                                       |
| Source verification          | Verified on [Blockscout](https://robinhoodchain.blockscout.com/address/0xBE5989a38953D8148B74d45eE6DEB127a32567E0)                                 |
| Owner                        | HISS Treasury Safe (2-of-3) `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`                                                                           |
| Fee recipient (`treasury()`) | HISS Treasury Safe (same address)                                                                                                                  |
| `feeBps()`                   | 500                                                                                                                                                |
| `MAX_FEE_BPS()` (immutable)  | 500                                                                                                                                                |
| Launch posture               | **Launched paused** — the immutable initial state; the owner-gated unpause has since executed on-chain. Current pause state is always a live read. |

> **Deployed ≠ active.** The contract launched paused (its immutable initial
> state) and the owner-gated unpause has since executed on-chain. Current
> `paused()` / `feeBps()` / `owner()` / `treasury()` state is always a **live
> chain read** — a failed read is "unknown", never "live" and never "not
> deployed". Unpaused alone opens nothing: enrollment and every managed action
> stay owner/beneficiary-gated.

## What this fee is not

- **Not** a deposit, withdrawal, principal, or performance fee.
- **Not** part of the $HISS trading-fee split — that split (50% xHISS stakers /
  15% vault providers / 15% vault contributors / 10% treasury / 10% economic
  burn) applies to verified $HISS token trading fees, a completely separate
  stream. See [$HISS token fees](./hiss-token-fees.md).
- **Not** charged on self-managed LP positions the user executes with their own
  authority.
- **Not** a yield, return, or profit guarantee of any kind.

Continue to: [Fees overview](./index.md) ·
[Stock Premium LP skill](../../skills/hiss-stock-premium-lp-manager/SKILL.md) ·
[Contracts](../contracts.md)
