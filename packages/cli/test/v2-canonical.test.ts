/**
 * V2-canonical contract for the REAL SDK-backed client facade.
 *
 * These tests run fully offline: prepare* encodes calldata locally (no RPC),
 * so they prove the CLI's live wiring — not a mock — routes the canonical V2
 * vault through the request queue, defaults V2 withdrawals to the in-kind
 * exit, and keeps every artifact strictly unsigned.
 */

import { describe, it, expect } from "vitest";
import { createHissClient } from "../src/lib/client.js";

const V2_VAULT = "0x432e90b1B35995EBE46eD93B4Db369abfc230E69";
const V2_QUEUE = "0x317d1eec013a91a316858e80bf782496f231729a";
const V1_LEGACY = "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6";
const RECEIVER = "0x1111111111111111111111111111111111111111";

// Unreachable RPC: reads would degrade; prepares never touch the network.
const client = createHissClient({ rpcUrl: "http://127.0.0.1:1", chainId: 4663 });

describe("canonical V2 deposit routes via the request queue", () => {
  it("targets the queue with an enqueue plan, signed:false", async () => {
    const tx = await client.prepareVaultDeposit(V2_VAULT, "100", RECEIVER, {
      nonce: "42",
      deadlineUnix: "1900000000",
    });
    expect(tx.signed).toBe(false);
    expect(tx.to.toLowerCase()).toBe(V2_QUEUE);
    expect(tx.function).toContain("enqueue");
    expect(tx.decodedArgs?.owner?.toLowerCase()).toBe(RECEIVER);
    expect(tx.decodedArgs?.flow).toContain("DEPOSIT");
    expect(tx.decodedArgs?.nonce).toBe("42");
    // 100 USDG → 6-dec base units.
    expect(tx.decodedArgs?.amount).toBe("100000000");
    expect(tx.data.length).toBeGreaterThan(10);
  });

  it("is reproducible for a fixed nonce/deadline (same plan hash)", async () => {
    const a = await client.prepareVaultDeposit(V2_VAULT, "100", RECEIVER, {
      nonce: "7",
      deadlineUnix: "1900000000",
    });
    const b = await client.prepareVaultDeposit(V2_VAULT, "100", RECEIVER, {
      nonce: "7",
      deadlineUnix: "1900000000",
    });
    expect(a.planHash).toBe(b.planHash);
    expect(a.data).toBe(b.data);
  });
});

describe("canonical V2 withdrawal exits", () => {
  it("defaults to the unconditional in-kind redemption on the vault", async () => {
    const tx = await client.prepareVaultWithdrawal(V2_VAULT, "5", RECEIVER);
    expect(tx.signed).toBe(false);
    expect(tx.to.toLowerCase()).toBe(V2_VAULT.toLowerCase());
    expect(tx.function).toContain("inKindRedeem");
  });

  it("mode queue_usdg routes through the request queue", async () => {
    const tx = await client.prepareVaultWithdrawal(V2_VAULT, "5", RECEIVER, {
      mode: "queue_usdg",
      nonce: "9",
      deadlineUnix: "1900000000",
    });
    expect(tx.signed).toBe(false);
    expect(tx.to.toLowerCase()).toBe(V2_QUEUE);
    expect(tx.function).toContain("enqueue");
    expect(tx.decodedArgs?.flow).toContain("USDG_REDEMPTION");
  });
});

describe("legacy V1 flagship is warned, never hidden", () => {
  it("a V1-targeted deposit plan carries the explicit legacy warning", async () => {
    const tx = await client.prepareVaultDeposit(V1_LEGACY, "100", RECEIVER);
    expect(tx.signed).toBe(false);
    expect(tx.to.toLowerCase()).toBe(V1_LEGACY);
    expect((tx.warnings ?? []).join(" ")).toMatch(/LEGACY/);
    expect((tx.warnings ?? []).join(" ")).toContain(V2_VAULT.toLowerCase());
  });

  it("a V1 withdrawal still prepares the ERC-4626 redeem (existing balances exit here)", async () => {
    const tx = await client.prepareVaultWithdrawal(V1_LEGACY, "5", RECEIVER);
    expect(tx.signed).toBe(false);
    expect(tx.to.toLowerCase()).toBe(V1_LEGACY);
    expect(tx.function).toContain("redeem");
  });
});
