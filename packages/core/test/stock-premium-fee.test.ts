// SPDX-License-Identifier: Apache-2.0
/**
 * Stock-Premium LP management fee — SSOT unit + property tests.
 *
 * `computeManagementFee` is the sole authority for the split of realized LP
 * fees. These tests pin the frozen policy constants, prove the arithmetic
 * invariants (P1–P6) that the deployed Solidity `HissLpManagerV1` mirrors, and
 * replay the committed parity vectors so TypeScript asserts against the exact
 * numbers the contract test-suite uses.
 *
 * Pure math, no network, no funds.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeManagementFee,
  HISS_LP_FEE_TREASURY,
  HISS_LP_MANAGEMENT_FEE_BPS,
  HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR,
  HISS_LP_MANAGEMENT_FEE_MAX_BPS,
  HISS_LP_MANAGEMENT_FEE_VERSION,
} from "../src/stock-premium/fee/index.js";
import {
  HISS_LP_MANAGER_V1_ADDRESS,
  HISS_LP_MANAGER_V1_CHAIN_ID,
  HISS_LP_MANAGER_V1_DEPLOYMENT,
  HISS_LP_MANAGER_V1_STATUS,
} from "../src/stock-premium/deployment.js";
import { HISS_TREASURY_SAFE } from "../src/rewards/split.js";
import { getContractAddress } from "../src/registry/contracts.js";

const VECTORS_PATH = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "management-fee-vectors.json");

interface Vectors {
  policyVersion: string;
  feeBps: number;
  maxBps: number;
  denominator: number;
  positive: {
    realizedLpFeeN: string[];
    feeBps: number[];
    protocolFeeN: string[];
    userFeeN: string[];
  };
  negative: {
    realizedLpFeeN: string[];
    feeBps: number[];
  };
}

const vectors = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as Vectors;

describe("HISS_LP_MANAGEMENT_FEE policy constants (frozen)", () => {
  it("pins the frozen policy version + bps", () => {
    expect(HISS_LP_MANAGEMENT_FEE_VERSION).toBe("HISS_LP_MANAGEMENT_FEE_V1");
    expect(HISS_LP_MANAGEMENT_FEE_BPS).toBe(500);
    expect(HISS_LP_MANAGEMENT_FEE_MAX_BPS).toBe(500);
    expect(HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR).toBe(10000);
  });

  it("default bps never exceeds the immutable ceiling", () => {
    expect(HISS_LP_MANAGEMENT_FEE_BPS).toBeLessThanOrEqual(HISS_LP_MANAGEMENT_FEE_MAX_BPS);
  });

  it("recipient IS the canonical Treasury Safe (imported, not re-literalized)", () => {
    expect(HISS_LP_FEE_TREASURY).toBe(HISS_TREASURY_SAFE);
    expect(HISS_LP_FEE_TREASURY).toBe("0xF100Fc28dd1721C698046Dbd60408c523b69e36c");
  });

  it("matches the committed parity vectors' policy header", () => {
    expect(vectors.policyVersion).toBe(HISS_LP_MANAGEMENT_FEE_VERSION);
    expect(vectors.feeBps).toBe(HISS_LP_MANAGEMENT_FEE_BPS);
    expect(vectors.maxBps).toBe(HISS_LP_MANAGEMENT_FEE_MAX_BPS);
    expect(vectors.denominator).toBe(HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR);
  });
});

describe("computeManagementFee — arithmetic invariants", () => {
  it("charges exactly 5% floored at the default bps ($19.12 ref, 6dp)", () => {
    // 19_120_000 * 500 / 10000 = 956_000
    const { protocolFeeN, userFeeN } = computeManagementFee(19_120_000n);
    expect(protocolFeeN).toBe(956_000n);
    expect(userFeeN).toBe(18_164_000n);
    expect(protocolFeeN + userFeeN).toBe(19_120_000n);
  });

  it("P6 zero-safe: realized 0 → both legs 0, no throw", () => {
    expect(computeManagementFee(0n)).toEqual({ protocolFeeN: 0n, userFeeN: 0n });
  });

  it("P2 dust favors the user (protocol floored to 0 on tiny amounts)", () => {
    expect(computeManagementFee(1n)).toEqual({ protocolFeeN: 0n, userFeeN: 1n });
    expect(computeManagementFee(19n)).toEqual({ protocolFeeN: 0n, userFeeN: 19n });
    expect(computeManagementFee(20n)).toEqual({ protocolFeeN: 1n, userFeeN: 19n });
  });

  it("P3 fail-closed: out-of-policy bps throws, never clamps", () => {
    expect(() => computeManagementFee(1_000_000n, 501)).toThrow(RangeError);
    expect(() => computeManagementFee(1_000_000n, -1)).toThrow(RangeError);
    expect(() => computeManagementFee(1_000_000n, 2.5)).toThrow(RangeError);
  });

  it("P4/P5 shape: single realized-fee input, no principal/P&L parameter", () => {
    expect(computeManagementFee.length).toBeLessThanOrEqual(2);
  });

  it("rejects non-bigint and negative inputs", () => {
    expect(() => computeManagementFee(-1n)).toThrow(RangeError);
    // @ts-expect-error deliberate wrong type
    expect(() => computeManagementFee(100)).toThrow(TypeError);
  });
});

describe("computeManagementFee — committed parity vectors (Solidity-equal)", () => {
  it("replays every positive vector exactly (P1 conservation on each)", () => {
    const { realizedLpFeeN, feeBps, protocolFeeN, userFeeN } = vectors.positive;
    expect(realizedLpFeeN.length).toBeGreaterThan(0);
    for (let i = 0; i < realizedLpFeeN.length; i++) {
      const input = BigInt(realizedLpFeeN[i] as string);
      const split = computeManagementFee(input, feeBps[i] as number);
      expect(split.protocolFeeN).toBe(BigInt(protocolFeeN[i] as string));
      expect(split.userFeeN).toBe(BigInt(userFeeN[i] as string));
      expect(split.protocolFeeN + split.userFeeN).toBe(input);
    }
  });

  it("every negative vector throws (fail-closed)", () => {
    const { realizedLpFeeN, feeBps } = vectors.negative;
    expect(realizedLpFeeN.length).toBeGreaterThan(0);
    for (let i = 0; i < realizedLpFeeN.length; i++) {
      expect(() => computeManagementFee(BigInt(realizedLpFeeN[i] as string), feeBps[i] as number)).toThrow();
    }
  });
});

describe("HissLpManagerV1 deployment record", () => {
  it("pins the deployed address via the canonical registry (chain 4663)", () => {
    expect(HISS_LP_MANAGER_V1_ADDRESS).toBe("0xBE5989a38953D8148B74d45eE6DEB127a32567E0");
    expect(HISS_LP_MANAGER_V1_ADDRESS).toBe(getContractAddress("lpManagerV1"));
    expect(HISS_LP_MANAGER_V1_CHAIN_ID).toBe(4663);
  });

  it("records the launched-paused posture — never a live claim", () => {
    expect(HISS_LP_MANAGER_V1_STATUS).toBe("DEPLOYED_PAUSED");
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.launchedPaused).toBe(true);
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.explorerVerified).toBe(true);
  });

  it("owner/treasury expectations reference the canonical Safe", () => {
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.expectedOwner).toBe(HISS_TREASURY_SAFE);
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.expectedTreasury).toBe(HISS_TREASURY_SAFE);
  });

  it("fee facts reference the fee SSOT", () => {
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.feePolicyVersion).toBe(HISS_LP_MANAGEMENT_FEE_VERSION);
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.expectedFeeBps).toBe(HISS_LP_MANAGEMENT_FEE_BPS);
    expect(HISS_LP_MANAGER_V1_DEPLOYMENT.immutableMaxFeeBps).toBe(HISS_LP_MANAGEMENT_FEE_MAX_BPS);
  });
});
