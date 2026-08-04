/**
 * check:contract-registry-live — verifies the contract registry against LIVE
 * on-chain code.
 *
 * For every entry in `contracts/deployments/robinhood-chain-mainnet.json` that
 * carries a `bytecodeHash`, this guard fetches the runtime bytecode from the
 * registry's own public RPC (`eth_getCode`) and recomputes
 * keccak256(runtime bytecode). Any divergence between the committed hash and
 * the live chain fails the check.
 *
 * FAIL-CLOSED semantics:
 *   - hash mismatch            -> FAIL (the registry is stale or wrong)
 *   - empty bytecode (0x)      -> FAIL (registry claims a deployment that
 *                                 is not observable on chain)
 *   - RPC/fetch failure        -> FAIL as explicit UNVERIFIED (an unreachable
 *                                 chain is never a pass)
 *   - zero hashed entries      -> FAIL (an empty verification set proves
 *                                 nothing)
 *
 * Dependency-free (Node built-ins only): keccak-256 is implemented inline and
 * self-tested against known vectors before any comparison — if the self-test
 * fails, the guard fails, never silently passes.
 */
import { join } from "node:path";
import { REPO_ROOT, readText } from "./lib/walk.ts";

// ---------------------------------------------------------------------------
// keccak-256 (original Keccak padding 0x01, as used by Ethereum), BigInt lanes
// ---------------------------------------------------------------------------

const KECCAK_ROUNDS = 24;
const MASK64 = (1n << 64n) - 1n;

const ROUND_CONSTANTS: bigint[] = [
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

/** Rho rotation offsets, indexed [x + 5y]. */
const RHO_OFFSETS: number[] = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
];

function rotl64(v: bigint, n: number): bigint {
  if (n === 0) return v & MASK64;
  return ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK64;
}

function keccakF1600(s: bigint[]): void {
  for (let round = 0; round < KECCAK_ROUNDS; round++) {
    // theta
    const c = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) c[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) s[x + 5 * y] ^= d;
    }
    // rho + pi
    const b = new Array<bigint>(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(s[x + 5 * y], RHO_OFFSETS[x + 5 * y]);
      }
    }
    // chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        s[x + 5 * y] = b[x + 5 * y] ^ (~b[((x + 1) % 5) + 5 * y] & b[((x + 2) % 5) + 5 * y]);
      }
    }
    // iota
    s[0] ^= ROUND_CONSTANTS[round];
  }
}

/** keccak256 of raw bytes, returned as 0x-prefixed lowercase hex. */
function keccak256(bytes: Uint8Array): string {
  const rate = 136; // 1088-bit rate for keccak-256
  const state = new Array<bigint>(25).fill(0n);

  // Multi-rate (original Keccak) padding: 0x01 … 0x80.
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let byte = 7; byte >= 0; byte--) {
        lane = (lane << 8n) | BigInt(padded[off + i * 8 + byte]);
      }
      state[i] ^= lane;
    }
    keccakF1600(state);
  }

  let out = "0x";
  for (let i = 0; i < 4; i++) {
    let lane = state[i];
    for (let byte = 0; byte < 8; byte++) {
      out += (lane & 0xffn).toString(16).padStart(2, "0");
      lane >>= 8n;
    }
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Known-answer self-test; the guard refuses to run on a broken hash. */
function keccakSelfTest(): void {
  const vectors: Array<[string, string]> = [
    ["", "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"],
    ["abc", "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"],
  ];
  for (const [input, expected] of vectors) {
    const got = keccak256(new TextEncoder().encode(input));
    if (got !== expected) {
      console.error(
        `check:contract-registry-live FAILED — keccak-256 self-test mismatch for ${JSON.stringify(input)}: got ${got}, expected ${expected}. Refusing to verify anything with a broken hash.`,
      );
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Registry verification
// ---------------------------------------------------------------------------

const REGISTRY_PATH = join(REPO_ROOT, "contracts", "deployments", "robinhood-chain-mainnet.json");

interface RegistryEntry {
  name: string;
  address: string;
  bytecodeHash?: string;
}

interface Registry {
  chainId: number;
  rpc: string;
  contracts: RegistryEntry[];
}

async function ethGetCode(rpc: string, address: string): Promise<string> {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getCode",
          params: [address, "latest"],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (typeof json.result !== "string") {
        throw new Error(`RPC error: ${json.error?.message ?? "no result"}`);
      }
      return json.result;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  throw new Error(lastError || "unreachable");
}

async function main(): Promise<void> {
  keccakSelfTest();

  const raw = readText(REGISTRY_PATH);
  if (!raw) {
    console.error(`check:contract-registry-live FAILED — cannot read ${REGISTRY_PATH}.`);
    process.exit(1);
  }
  const registry = JSON.parse(raw) as Registry;
  const hashed = registry.contracts.filter((c) => typeof c.bytecodeHash === "string");
  if (hashed.length === 0) {
    console.error(
      "check:contract-registry-live FAILED — no registry entry carries a bytecodeHash; an empty verification set proves nothing.",
    );
    process.exit(1);
  }

  console.log(
    `check:contract-registry-live — verifying ${hashed.length} bytecodeHash entries against ${registry.rpc} (chain ${registry.chainId})…`,
  );

  const failures: string[] = [];
  for (const entry of hashed) {
    let code: string;
    try {
      code = await ethGetCode(registry.rpc, entry.address);
    } catch (e) {
      // A fetch failure is an explicit UNVERIFIED failure, never a pass.
      failures.push(
        `${entry.name} (${entry.address}): UNVERIFIED — live code fetch failed (${(e as Error).message}).`,
      );
      continue;
    }
    if (code === "0x" || code === "") {
      failures.push(
        `${entry.name} (${entry.address}): NO BYTECODE on chain but the registry records hash ${entry.bytecodeHash}.`,
      );
      continue;
    }
    const liveHash = keccak256(hexToBytes(code));
    if (liveHash !== entry.bytecodeHash!.toLowerCase()) {
      failures.push(
        `${entry.name} (${entry.address}): HASH MISMATCH — registry ${entry.bytecodeHash}, live ${liveHash}.`,
      );
      continue;
    }
    console.log(`  ok ${entry.name.padEnd(30)} ${entry.address}  ${liveHash}`);
  }

  if (failures.length > 0) {
    console.error(`\ncheck:contract-registry-live FAILED — ${failures.length} entr(y/ies):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`check:contract-registry-live OK — ${hashed.length}/${hashed.length} live-code matches.`);
}

main().catch((e) => {
  console.error(`check:contract-registry-live FAILED — unexpected error: ${(e as Error).message}`);
  process.exit(1);
});
