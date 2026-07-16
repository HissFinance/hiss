// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  assertChainId,
  isSupportedChainId,
  getChainById,
  ROBINHOOD_CHAIN_MAINNET_ID,
} from "../src/chain/config.js";
import { parseBrokerSymbol, parseTokenAddress, isBrokerSymbol } from "../src/symbols/space.js";

describe("chain config", () => {
  it("recognizes supported chain ids", () => {
    expect(isSupportedChainId(4663)).toBe(true);
    expect(isSupportedChainId(46630)).toBe(true);
    expect(isSupportedChainId(8453)).toBe(false); // Base is never a HISS chain
  });

  it("asserts the expected chain and rejects the wrong chain", () => {
    expect(() => assertChainId(4663, ROBINHOOD_CHAIN_MAINNET_ID)).not.toThrow();
    expect(() => assertChainId(8453, ROBINHOOD_CHAIN_MAINNET_ID)).toThrow(/wrong chain/);
    expect(() => assertChainId(1)).toThrow();
  });

  it("resolves chain metadata", () => {
    expect(getChainById(4663)?.name).toBe("Robinhood Chain");
    expect(getChainById(999)).toBeUndefined();
  });
});

describe("symbol spaces never blur", () => {
  it("parses a plain brokerage ticker", () => {
    expect(parseBrokerSymbol("nvda")).toBe("NVDA");
    expect(isBrokerSymbol("AAPL")).toBe(true);
  });

  it("rejects an address where a ticker is required", () => {
    expect(() => parseBrokerSymbol("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3")).toThrow(/symbol-space/);
    expect(isBrokerSymbol("0xabc")).toBe(false);
  });

  it("parses a token address", () => {
    expect(parseTokenAddress("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3")).toBe(
      "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
    );
  });

  it("rejects a ticker where a token address is required", () => {
    expect(() => parseTokenAddress("NVDA")).toThrow(/symbol-space/);
    expect(() => parseTokenAddress("0x123")).toThrow(/invalid token address/);
  });
});
