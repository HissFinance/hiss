# OpenClaw operator — safety model (sanitized reference)

A sanitized, public-safe description of how HISS runs its always-on local
operator and its governed scheduled jobs. This is a **template / model** — it
deliberately contains no host paths, credentials, channel identifiers, wallet
addresses, or private infrastructure detail. The authoritative, environment-
specific configuration is private. This page documents the _safety contract_ the
operator runs under, so integrators can see exactly what an autonomous scheduler
is and is not permitted to do.

## Model

- A single self-hosted **gateway** process runs the operator, bound to loopback
  only, behind token auth, kept alive by the host service manager.
- One **agent** identity executes all scheduled work in isolated sessions.
  Operating memory (context, standing orders, active work, queue) lives in a
  workspace that is a **read cache** of the private source repository, never a
  competing source of truth.
- Scheduled **jobs** run through the gateway's cron scheduler. Each job has a
  fixed timezone, a namespaced key, and delivers a concise final report to a
  single private operator channel. Job definitions are managed only through the
  scheduler CLI, never by editing its store directly.

## Repository boundaries

- The **private** repository is authoritative for code and methodology. The
  **public** repository is a downstream, sanitized SDK/site mirror and is never
  the source of truth for production state.
- Every path is classified by its git remote before any action. Private and
  public credentials are strictly separated; a public token can never touch the
  private repository, and private source, secrets, or host paths are never
  copied into the public repository (an export check gates every publish).

## Transaction authority

- **No scheduled job signs.** Treasury actions use a multi-signature Safe and are
  human-signed. Any automated financial flow is a deterministic, double-gated
  executor (typed method + owner-set approval flag + exact plan-hash), records
  on-chain receipts, and is separately kill-switchable. Planned ≠ funded ≠
  claimable at every step.

## Governed cron authority

The local operator **may** autonomously create/edit ONLY read-only, monitoring,
alerting, report, and prepare-only jobs.

The local operator may **never** autonomously create a job that signs a
multi-sig transaction, changes a fee/treasury/policy parameter, unpauses,
deploys, widens a risk fuse, moves assets, or bypasses eligibility.

A financial-action job may exist only when explicitly authored for owner review
and carrying **all eight** controls: typed method, owner policy flag, bounded
grant, simulation, risk fuses, idempotency, receipt, and kill switch. Tooling
refuses to validate a financial-action job that is marked autonomous or
auto-managed.

## Desired-state tooling

- A **manifest** describes the desired set of jobs, each tagged by class
  (monitoring / report / research / prepare / financial-action / mutation) and
  by whether the operator may manage it autonomously.
- A **doctor** validates the manifest against a schema and the authority policy,
  and fails on any embedded secret, path, or channel identifier.
- A **reconciler** (dry-run by default) creates only the safe, autonomous,
  manifest-managed jobs that are missing; it never edits or deletes pre-existing
  jobs and never creates financial or mutation jobs.
- An **evidence exporter** snapshots live job definitions and run history into a
  sanitized bundle (delivery targets, channel ids, and tokens redacted).

## Independent watchdog

A separate **sentinel** runs from the host service manager — **not** from the
cron scheduler it monitors — so it can detect a dead or stalled scheduler. Its
down-detection is host-level (service label, loopback port, on-disk store).
When the gateway is unreachable it persists a local incident record rather than
relying on the very system that failed, then best-effort alerts the operator.

## Safe create / test / verify procedure

1. Add the job to the manifest as a safe, autonomous, managed job with an
   authored prompt.
2. Validate with the doctor.
3. Reconcile in dry-run to confirm it is genuinely new (no duplicate).
4. Create it **disabled**; record its id.
5. Inspect the stored definition.
6. Run it once manually; read the result; verify no secret/identifier leak.
7. Enable it.
8. Confirm it is enabled with a future next-run time.

## Kill switches

Planned-maintenance flag (all jobs skip), disable one job, pause all repository
mutation, disable the financial executor, stop the gateway service, and a run
lock that serializes mutating jobs. Exits and safety controls are never gated
behind the same switch as normal operation.
