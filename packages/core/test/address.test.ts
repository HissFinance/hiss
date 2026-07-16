// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  isAddress,
  isChecksumAddress,
  toChecksumAddress,
  normalizeAddress,
  addressesEqual,
} from "../src/address/address.js";
import { keccak256Hex } from "../src/crypto/keccak256.js";
import { sha256Hex } from "../src/crypto/sha256.js";

describe("keccak256", () => {
  it("matches the empty-string test vector", () => {
    expect(keccak256Hex("")).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });
  it("matches the 'abc' test vector", () => {
    expect(keccak256Hex("abc")).toBe("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
  });
});

describe("sha256", () => {
  it("matches the empty-string test vector", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("matches the 'abc' test vector", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("address helpers", () => {
  it("accepts and rejects address shapes", () => {
    expect(isAddress("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3")).toBe(true);
    expect(isAddress("0x123")).toBe(false);
    expect(isAddress("not-an-address")).toBe(false);
  });

  it("produces valid EIP-55 checksums", () => {
    const lower = "0x47162135cc8fb253f939bd70e3d2b83075eaeba3";
    expect(toChecksumAddress(lower)).toBe("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3");
  });

  it("recognizes a valid mixed-case checksum and rejects a corrupted one", () => {
    expect(isChecksumAddress("0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3")).toBe(true);
    // Flip one nibble's case to corrupt the checksum.
    expect(isChecksumAddress("0x47162135cc8fb253f939Bd70e3D2B83075eaeBA3")).toBe(false);
  });

  it("normalizes and compares case-insensitively", () => {
    expect(normalizeAddress("0xAB0000000000000000000000000000000000CDEF")).toBe(
      "0xab0000000000000000000000000000000000cdef",
    );
    expect(
      addressesEqual(
        "0xABCabc0000000000000000000000000000000000",
        "0xabcABC0000000000000000000000000000000000",
      ),
    ).toBe(true);
  });

  it("throws on malformed input to checksum", () => {
    expect(() => toChecksumAddress("0xzz")).toThrow();
  });
});
