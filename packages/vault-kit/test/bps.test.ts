import { describe, it, expect } from "vitest";
import { TOTAL_BPS, normalizeToTotalBps, isNormalized, sumBps, rescaleBps } from "../src/bps";
import {
  equalWeightAllocation,
  buildAllocation,
  normalizeWithLocks,
  withReserve,
  compareAllocations,
} from "../src/allocation";

describe("normalizeToTotalBps", () => {
  it("sums to exactly 10,000 for indivisible splits (3 assets)", () => {
    const out = normalizeToTotalBps([1, 1, 1]);
    expect(sumBps(out)).toBe(TOTAL_BPS);
    // largest-remainder gives the leftover bp to the earliest entry
    expect(out).toEqual([3334, 3333, 3333]);
  });

  it("respects relative weights", () => {
    const out = normalizeToTotalBps([2, 1, 1]);
    expect(sumBps(out)).toBe(TOTAL_BPS);
    expect(out).toEqual([5000, 2500, 2500]);
  });

  it("sums to exactly 10,000 for 7 equal assets", () => {
    const out = normalizeToTotalBps(new Array(7).fill(1));
    expect(sumBps(out)).toBe(TOTAL_BPS);
    expect(out.every((v) => Number.isInteger(v))).toBe(true);
  });

  it("assigns zero to zero weights", () => {
    const out = normalizeToTotalBps([1, 0, 1]);
    expect(out).toEqual([5000, 0, 5000]);
  });

  it("rejects all-zero and negative weights", () => {
    expect(() => normalizeToTotalBps([0, 0])).toThrow();
    expect(() => normalizeToTotalBps([-1, 2])).toThrow();
  });

  it("rescales into a smaller budget", () => {
    const out = rescaleBps([6000, 4000], 9000);
    expect(sumBps(out)).toBe(9000);
    expect(out).toEqual([5400, 3600]);
  });
});

describe("allocation builders sum to 10,000", () => {
  const assets = [
    { symbol: "AAA", address: "0x1111111111111111111111111111111111111111" },
    { symbol: "BBB", address: "0x2222222222222222222222222222222222222222" },
    { symbol: "CCC", address: "0x3333333333333333333333333333333333333333" },
  ];

  it("equalWeightAllocation normalizes to 10,000", () => {
    const alloc = equalWeightAllocation(assets);
    expect(isNormalized(alloc.map((a) => a.weightBps))).toBe(true);
  });

  it("buildAllocation normalizes arbitrary weights", () => {
    const alloc = buildAllocation([
      { symbol: "AAA", address: assets[0]!.address, weight: 5 },
      { symbol: "BBB", address: assets[1]!.address, weight: 3 },
      { symbol: "CCC", address: assets[2]!.address, weight: 2 },
    ]);
    expect(alloc.map((a) => a.weightBps)).toEqual([5000, 3000, 2000]);
    expect(alloc[0]!.address).toBe(assets[0]!.address.toLowerCase());
  });

  it("normalizeWithLocks preserves locked weights and fills the rest", () => {
    const alloc = normalizeWithLocks([
      { symbol: "AAA", address: assets[0]!.address, weightBps: 4000, locked: true },
      { symbol: "BBB", address: assets[1]!.address, weightBps: 1 },
      { symbol: "CCC", address: assets[2]!.address, weightBps: 1 },
    ]);
    expect(alloc[0]!.weightBps).toBe(4000);
    expect(sumBps(alloc.map((a) => a.weightBps))).toBe(TOTAL_BPS);
    expect(alloc[1]!.weightBps).toBe(3000);
    expect(alloc[2]!.weightBps).toBe(3000);
  });

  it("withReserve carves a reserve leg and re-sums to 10,000", () => {
    const alloc = withReserve(
      buildAllocation([
        { symbol: "AAA", address: assets[0]!.address, weight: 1 },
        { symbol: "BBB", address: assets[1]!.address, weight: 1 },
      ]),
      { symbol: "USDG", address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", reserveBps: 1000 },
    );
    expect(sumBps(alloc.map((a) => a.weightBps))).toBe(TOTAL_BPS);
    const reserve = alloc.find((a) => a.symbol === "USDG");
    expect(reserve?.weightBps).toBe(1000);
  });

  it("compareAllocations reports drift and turnover", () => {
    const target = buildAllocation([
      { symbol: "AAA", address: assets[0]!.address, weight: 1 },
      { symbol: "BBB", address: assets[1]!.address, weight: 1 },
    ]);
    const current = buildAllocation([
      { symbol: "AAA", address: assets[0]!.address, weight: 3 },
      { symbol: "BBB", address: assets[1]!.address, weight: 1 },
    ]);
    const cmp = compareAllocations(target, current);
    expect(cmp.maxAbsDriftBps).toBe(2500);
    expect(cmp.turnoverBps).toBe(2500);
  });
});
