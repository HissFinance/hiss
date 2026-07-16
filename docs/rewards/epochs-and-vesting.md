# Epochs and vesting

Rewards are computed over **epochs** and released through **linear vesting**, with an
explicit lifecycle that keeps **planned ≠ funded ≠ vesting ≠ claimable**. Nothing is
ever claimable early. This is the canonical `HISS_REWARD_METHOD_V1` lifecycle.

## The lifecycle state machine

```
provisional → final → challenge → funded → vesting → claimable → claimed
                 ▲         │                    │          │
                 └─────────┘ (sustained         └──────────┴──▶ rolled_over
                    challenge forces                (unclaimed remainder)
                    recomputation)
```

| State         | Meaning                                              | Claimable?              |
| ------------- | ---------------------------------------------------- | ----------------------- |
| `provisional` | Weekly checkpoint, not final                         | No                      |
| `final`       | Monthly score finalized deterministically            | No                      |
| `challenge`   | Published; inside the 7-day challenge window         | No                      |
| `funded`      | Safe-authorized and on-chain funded after the window | Not yet                 |
| `vesting`     | Linear vesting underway                              | Partly (vested portion) |
| `claimable`   | Vested-but-unclaimed exists                          | Yes                     |
| `claimed`     | Fully claimed                                        | —                       |
| `rolled_over` | Unclaimed remainder returned                         | —                       |

## Weekly checkpoints

- **4–5 weekly provisional checkpoints** per monthly epoch (interval 7 days).
- Checkpoints are computed and published as artifacts (`hiss-reward-weekly-checkpoint-v1`)
  but are **never claimable** — they are progress, not finality.

## Monthly finalization

- At month end, a deterministic **epoch-score artifact**
  (`hiss-reward-monthly-epoch-score-v1`) is built from source events: it runs the
  depositor and provider scorers, builds the on-chain-matching **merkle roots**, stamps
  per-leaf metadata hashes, and computes a content hash. Same events → identical roots
  and hashes (reproducible).
- The artifact starts in `final` and carries its **challenge window**.

## The 7-day challenge window

- After publication, a **7-day public challenge window** opens. Epochs in the window are
  **not claimable**.
- A **sustained challenge** forces recomputation (`challenge → final`), so a valid
  dispute changes the outcome before anyone can claim.

## Funding (owner-gated)

- Funding requires the **2-of-3 Treasury Safe** and happens **only after** the challenge
  window closes. **Planned ≠ funded** — a plan is data with a keccak plan hash; funding
  is on-chain and authorized.

## Vesting (linear)

- **Depositor leg:** 30-day linear vest (`DEPOSITOR_VEST_SECONDS`).
- **Provider leg:** 90-day linear vest (`PROVIDER_VEST_SECONDS`; on-chain provider
  vesting is modelled pending the distributor delta).
- **Vested amount:** 0 before `vestStart`, `total` at/after `vestEnd`, linear in between
  — computed identically off-chain and on-chain for the depositor leg.
- **Claimable-now:** `vested − alreadyClaimed`, floored at 0, and **hard-zero** unless
  the epoch is **funded**, the **challenge window is closed**, and the epoch is **open**.

## Rollover

- **Depositor** unclaimed remainder → **Treasury** after the claim deadline.
- **Provider** uncapped/unclaimed remainder → the **next provider epoch**.

## Reading epoch status

```ts
const epoch = await hiss.rewards.readEpochStatus({ epochId });
// state, window, challenge window start/end, pools, vesting windows, claimable
```

MCP: `hiss_get_reward_epoch_status`.

## Honesty rules

- **Not a performance claim.** Epoch amounts depend on verified fee income HISS does not
  control.
- **Planned ≠ funded ≠ vesting ≠ claimable** — never collapse these on any surface.
- A failed read is **unknown**; a challenge-window epoch is **not** claimable.
