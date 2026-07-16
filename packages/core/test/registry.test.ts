// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  CONTRACT_REGISTRY,
  TREASURY_SAFE_OWNERS,
  TREASURY_SAFE_THRESHOLD,
  TREASURY_SAFE_OWNER_COUNT,
  getContractAddress,
  getContract,
  findContractByAddress,
  allRegistryAddressesChecksummed,
} from "../src/registry/contracts.js";
import {
  USDG_ASSET,
  HISS_ASSET,
  getAssetBySymbol,
  USDG_DECIMALS,
  HISS_DECIMALS,
} from "../src/registry/assets.js";
import { isChecksumAddress } from "../src/address/address.js";

describe("contract registry", () => {
  it("stores every address in valid EIP-55 checksum form", () => {
    expect(allRegistryAddressesChecksummed()).toBe(true);
    for (const entry of Object.values(CONTRACT_REGISTRY)) {
      expect(isChecksumAddress(entry.address)).toBe(true);
    }
  });

  it("resolves canonical addresses by key", () => {
    expect(getContractAddress("hissToken")).toBe("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3");
    expect(getContractAddress("treasurySafe")).toBe("0xF100Fc28dd1721C698046Dbd60408c523b69e36c");
    expect(getContractAddress("xHissVault")).toBe("0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be");
    expect(getContractAddress("vaultFactory")).toBe("0x278d237c6890a5f7101296a9021ed9D26c821810");
  });

  it("every entry is on Robinhood Chain mainnet 4663", () => {
    for (const entry of Object.values(CONTRACT_REGISTRY)) {
      expect(entry.chainId).toBe(4663);
    }
  });

  it("reverse-resolves by address, case-insensitively", () => {
    const found = findContractByAddress("0x47162135cc8fb253f939bd70e3d2b83075eaeba3");
    expect(found?.key).toBe("hissToken");
  });

  it("throws on an unknown key", () => {
    // @ts-expect-error unknown key at compile time
    expect(() => getContract("nope")).toThrow();
  });

  it("pins the 2-of-3 Safe owner set", () => {
    expect(TREASURY_SAFE_THRESHOLD).toBe(2);
    expect(TREASURY_SAFE_OWNER_COUNT).toBe(3);
    expect(TREASURY_SAFE_OWNERS).toHaveLength(3);
    for (const owner of TREASURY_SAFE_OWNERS) expect(isChecksumAddress(owner)).toBe(true);
  });
});

describe("asset registry", () => {
  it("pins USDG at 6 decimals and HISS at 18", () => {
    expect(USDG_ASSET.decimals).toBe(6);
    expect(USDG_DECIMALS).toBe(6);
    expect(HISS_ASSET.decimals).toBe(18);
    expect(HISS_DECIMALS).toBe(18);
    expect(USDG_ASSET.address).toBe("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
  });

  it("resolves assets by symbol", () => {
    expect(getAssetBySymbol("usdg")?.role).toBe("base_asset");
    expect(getAssetBySymbol("HISS")?.role).toBe("protocol_token");
  });
});
