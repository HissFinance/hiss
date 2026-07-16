// SPDX-License-Identifier: Apache-2.0
/**
 * Keccak-256 (the pre-standard Ethereum variant, 0x01 domain padding).
 *
 * Dependency-free, synchronous, and identical in Node and browser bundles.
 * Used for EIP-55 address checksums and for content-hashing reward artifacts
 * when a keccak hasher is required. Operates on Keccak-f[1600] with 64-bit
 * lanes represented as BigInt.
 *
 * This is NOT SHA3-256 (which uses 0x06 domain padding); the two produce
 * different digests for the same input.
 */

const ROUND_CONSTANTS: readonly bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

// Rho rotation offsets, indexed [x][y]; lane index is x + 5 * y.
const RHO: readonly (readonly number[])[] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const LANE_MASK = (1n << 64n) - 1n;

function rotateLeft(value: bigint, bits: bigint): bigint {
  if (bits === 0n) return value;
  return ((value << bits) | (value >> (64n - bits))) & LANE_MASK;
}

function keccakF1600(state: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    // Theta
    const c = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) {
      c[x] = state[x]! ^ state[x + 5]! ^ state[x + 10]! ^ state[x + 15]! ^ state[x + 20]!;
    }
    const d = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) {
      d[x] = c[(x + 4) % 5]! ^ rotateLeft(c[(x + 1) % 5]!, 1n);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 25; y += 5) state[x + y]! ^= d[x]!;
    }

    // Rho + Pi
    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft(state[x + 5 * y]!, BigInt(RHO[x]![y]!));
      }
    }

    // Chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] =
          b[x + 5 * y]! ^ (~b[((x + 1) % 5) + 5 * y]! & LANE_MASK & b[((x + 2) % 5) + 5 * y]!);
      }
    }

    // Iota
    state[0]! ^= ROUND_CONSTANTS[round]!;
  }
}

/** Keccak-256 of a byte array, returning 32 bytes. */
export function keccak256Bytes(input: Uint8Array | number[]): Uint8Array {
  const rate = 136; // 1088-bit rate (capacity 512) for 256-bit output
  const state = new Array<bigint>(25).fill(0n);

  const padded = Array.from(input);
  padded.push(0x01);
  while (padded.length % rate !== 0) padded.push(0x00);
  padded[padded.length - 1]! |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let value = 0n;
      for (let byte = 0; byte < 8; byte++) {
        value |= BigInt(padded[offset + lane * 8 + byte]!) << BigInt(8 * byte);
      }
      state[lane]! ^= value;
    }
    keccakF1600(state);
  }

  const out = new Uint8Array(32);
  for (let lane = 0; lane < 4; lane++) {
    for (let byte = 0; byte < 8; byte++) {
      out[lane * 8 + byte] = Number((state[lane]! >> BigInt(8 * byte)) & 0xffn);
    }
  }
  return out;
}

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code < 0xdc00 && i + 1 < text.length) {
      const high = code;
      const low = text.charCodeAt(++i);
      code = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Keccak-256 of a UTF-8 string, hex-encoded WITHOUT a 0x prefix. */
export function keccak256Hex(text: string): string {
  return toHex(keccak256Bytes(utf8Bytes(text)));
}

/** Keccak-256 of a UTF-8 string, hex-encoded WITH a 0x prefix. */
export function keccak256(text: string): string {
  return `0x${keccak256Hex(text)}`;
}
