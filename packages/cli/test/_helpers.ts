/**
 * Shared, deterministic test harness for the HISS CLI quality/accessibility
 * matrix (Agent 4). Everything here is hermetic: no network, no live RPC, no
 * process globals leak into an assertion. Clients, fetch, clock, width, color,
 * and Unicode are all injected.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { testContext, type OutputContext } from "../src/lib/context.js";
import { renderResult, type CommandResult, type RenderMeta } from "../src/lib/output.js";
import { stripAnsi } from "../src/lib/width.js";
import type { HissClient, JsonRecord, UnsignedTx } from "../src/lib/types.js";
import type { FetchLike } from "../src/commands/mcp.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to a file under `test/fixtures/`. */
export const fixture = (name: string): string => join(here, "fixtures", name);

/** The fixtures skills root (contains demo-pack, second-pack). */
export const SKILLS_DIR = join(here, "fixtures", "skills");

/** A full, canonical unsigned transaction with a real-length target address. */
export const SAMPLE_TX: UnsignedTx = {
  chainId: 4663,
  to: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  data: "0xb6b55f25000000000000000000000000000000000000000000000000000000003b9aca00",
  value: "0",
  description: "deposit into the vault",
  signed: false,
};

/**
 * A deterministic, fully-wired mock HissClient. Every read returns stable data;
 * every prepare returns {@link SAMPLE_TX}. Override any method for a specific
 * test (degraded reads, throwing reads, etc.).
 */
export function mockClient(overrides: Partial<HissClient> = {}): HissClient {
  const tx = () => Promise.resolve(SAMPLE_TX);
  const base: HissClient = {
    getProtocolStatus: () =>
      Promise.resolve({
        network: "robinhood-chain-mainnet",
        chain: "4663",
        chainId: 4663,
        reachable: true,
        blockNumber: "123456789",
        token: { symbol: "HISS", address: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3" },
        vaultCount: 2,
        treasurySafe: "0xF100Fc28dd1721C698046Dbd60408c523b69e36c",
        rpcUrl: "https://rpc.example.invalid",
        vaults: {
          canonicalDepositVault: "0x432e90b1b35995ebe46ed93b4db369abfc230e69",
          canonicalLabel:
            "HISS Vault V2 — canonical new-deposit vault (queue-routed epoch settlement, 24/7 lanes)",
          legacyV1Vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
          legacyLabel:
            "HISS Vault (flagship V1) — LEGACY: closed to new deposits; existing balances withdraw/redeem here",
          note: "Static lifecycle facts — queue/keeper/capacity/pause state is a live read (getVaultV2Status).",
        },
      }),
    getContractRegistry: () =>
      Promise.resolve({
        hissToken: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
        vaultFactory: "0x278d237c6890a5f7101296a9021ed9D26c821810",
        treasurySafe: "0xF100Fc28dd1721C698046Dbd60408c523b69e36c",
      }),
    listVaults: () =>
      Promise.resolve([
        {
          name: { state: "live", value: "HISS Vault V2" },
          address: "0x432e90b1b35995ebe46ed93b4db369abfc230e69",
          lifecycle: "canonical_v2",
          depositRoute: "request_queue",
        },
        {
          name: { state: "live", value: "HISS Vault" },
          address: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
          lifecycle: "legacy_v1",
          depositRoute: "erc4626_deposit",
          acceptingPublicDeposits: { state: "live", value: false },
        },
      ]),
    getVault: (ref: string) =>
      Promise.resolve({
        name: { state: "live", value: "HISS Vault V2" },
        address: "0x432e90b1b35995ebe46ed93b4db369abfc230e69",
        lifecycle: "canonical_v2",
        depositRoute: "request_queue",
        baseAsset: "USDG",
        totalSupply: { state: "live", value: "520655374841481296331" },
        totalAssets: { state: "live", value: "481000000" },
        requestedRef: ref,
      }),
    getVaultV2Status: () =>
      Promise.resolve({
        vault: "0x432e90b1b35995ebe46ed93b4db369abfc230e69",
        chainId: 4663,
        source: {
          rpcUrl: "https://rpc.example.invalid",
          blockNumber: "123456789",
          blockTimestampUnix: 1767225600,
        },
        vaultReads: {
          paused: { state: "live", value: false },
          totalSupply: { state: "live", value: "520655374841481296331" },
          totalAssets: { state: "live", value: "481000000" },
          usdgCash: { state: "live", value: "120000000" },
          queueActive: { state: "live", value: true },
          pendingRedeemCount: { state: "live", value: "0" },
        },
        queue: {
          address: "0x317d1eec013a91a316858e80bf782496f231729a",
          paused: { state: "live", value: false },
          pendingCount: { state: "live", value: "0" },
          pendingDepositUsdg: { state: "live", value: "0" },
          pendingRedemptionShares: { state: "live", value: "0" },
        },
        keeper: {
          state: "HEALTHY",
          keeperActive: { state: "live", value: true },
          settlementActive: { state: "live", value: true },
          reason: "Settler keeper authority active and liveness evidence fresh.",
        },
        rebalancing: {
          active: false,
          byPolicy: true,
          reason:
            "AAPL is currently the only execution-grade Stock Token asset. Initial public operation uses settlement-driven allocation and preserves the current USDG cash reserve.",
        },
        liveness: { state: "OK", executionAllowed: true, ageSeconds: "42" },
        capacity: {
          immediateDepositCapacityUsdg: "2500000000",
          immediateUsdgRedemptionCapacityUsdg: "120000000",
          perAsset: [],
        },
        note: "Live chain reads on the canonical V2 vault. A failed leg is UNKNOWN (null/degraded) — never fabricated. Rebalancing inactive is owner-declared policy, not a fault state. Not a performance claim.",
      }),
    getVaultHoldings: (vault: string) =>
      Promise.resolve({
        vault,
        source: "onchain",
        holdings: [
          {
            asset: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
            symbol: { state: "live", value: "HISS" },
            balance: { state: "live", value: "1000000000000000000000" },
          },
          {
            asset: "0xb3b6CE5b1C6605dBE897555DdaA191c2AF0A7D10",
            symbol: { state: "unknown" },
            balance: { state: "unknown" },
          },
        ],
      }),
    getVaultPerformance: (vault: string) =>
      Promise.resolve({ vault, pricePerShare: { state: "live", value: "1000000000000000000" } }),
    getStakingStatus: () =>
      Promise.resolve({
        vaultAddress: "0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be",
        stakingAsset: "HISS",
        paused: { value: false },
        cooldownSeconds: 259200,
      }),
    getRewardStatus: () =>
      Promise.resolve({
        model: {
          version: "HISS_REWARD_METHOD_V2",
          legs: {
            xhissStakersBps: 5000,
            vaultProvidersBps: 1500,
            vaultContributorsBps: 1500,
            treasuryBps: 1000,
            burnBps: 1000,
          },
        },
        funded: false,
      }),
    getVaultContributorReward: (address: string) => Promise.resolve({ account: address, funded: false }),
    getProviderReward: (groupId: string) => Promise.resolve({ group: groupId, funded: false }),
    getReceipt: () => Promise.reject(new Error("not used in this test")),
    getSupportedAssets: () => Promise.resolve([]),
    getFeeSchedule: () => Promise.resolve({}),
    prepareVaultCreation: tx,
    prepareVaultDeposit: tx,
    prepareVaultWithdrawal: tx,
    prepareHissStake: tx,
    prepareXhissCooldown: tx,
    prepareXhissRedeem: tx,
  };
  return { ...base, ...overrides };
}

/** A client whose reads all reject with a network-shaped error (exit-4 path). */
export function networkFailingClient(message = "fetch failed"): HissClient {
  const boom = () => Promise.reject(new Error(message));
  return mockClient({
    getProtocolStatus: boom,
    getContractRegistry: boom,
    listVaults: boom,
    getVault: boom,
    getVaultHoldings: boom,
    getVaultPerformance: boom,
    getStakingStatus: boom,
    getRewardStatus: boom,
  });
}

/** A hosted-MCP `/version` payload used by the healthy-fetch mock. */
export const MCP_VERSION = {
  chainId: 4663,
  transport: "http",
  toolCount: 33,
  toolsetHash: "0xa9b97e7f0000000000000000000000000000000000000000000000000000abcd",
  server: { name: "hiss-mcp", version: "1.2.3" },
  sourceSha: "deadbeef",
  publicSha: "cafebabe",
};

/** A FetchLike that answers every hosted-MCP probe with HTTP 200 + JSON. */
export function healthyMcpFetch(version: Record<string, unknown> = MCP_VERSION): FetchLike {
  return async (url: string) => {
    const body = url.endsWith("/version") ? version : { ok: true };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

/** A FetchLike that rejects for every probe (network-down → UNKNOWN, exit 4). */
export const downMcpFetch: FetchLike = async () => {
  throw new Error("getaddrinfo ENOTFOUND mcp.hiss.finance");
};

export interface Captured {
  ctx: OutputContext;
  /** All bytes written to the primary (stdout) sink. */
  out: () => string;
  /** All bytes written to the diagnostics (stderr) sink. */
  err: () => string;
}

/**
 * A deterministic capturing OutputContext. Fixed width (default 80), frozen
 * clock, and capturing stdout/stderr writers. `mode`, `color`, `unicode`,
 * `verbosity`, `width`, and `interactive` are overridable.
 */
export function capture(overrides: Partial<OutputContext> = {}): Captured {
  let outBuf = "";
  let errBuf = "";
  const ctx = testContext({
    stdout: (c: string) => {
      outBuf += c;
    },
    stderr: (c: string) => {
      errBuf += c;
    },
    ...overrides,
  });
  return { ctx, out: () => outBuf, err: () => errBuf };
}

/** Render a result and return the captured stdout/stderr for a mode/context. */
export function renderCapture(
  result: CommandResult,
  overrides: Partial<OutputContext> = {},
  meta?: RenderMeta,
): { stdout: string; stderr: string } {
  const cap = capture(overrides);
  renderResult(result, cap.ctx, meta);
  return { stdout: cap.out(), stderr: cap.err() };
}

export { stripAnsi };
export type { CommandResult, OutputContext, JsonRecord };

/** True when the string contains at least one ANSI escape sequence. */
export function hasAnsi(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return s.indexOf("") !== -1;
}

/** All non-ASCII code points present in a string (for accessibility scans). */
export function nonAscii(s: string): string[] {
  const set = new Set<string>();
  for (const ch of s) if ((ch.codePointAt(0) ?? 0) > 0x7f) set.add(ch);
  return [...set];
}
