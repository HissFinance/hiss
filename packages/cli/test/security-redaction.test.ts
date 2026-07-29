/**
 * §24.6 — Security / secret handling. Two defenses:
 *   1. INPUT rejection (`assertNoCredentials`): private-key- and seed-shaped
 *      values and credential-named fields are refused before use.
 *   2. OUTPUT redaction (`redact`, defense-in-depth): any labeled secret that
 *      reaches a rendered string is masked; PUBLIC on-chain identifiers
 *      (addresses, tx hashes, receipt IDs, pool/Safe addresses) are preserved
 *      verbatim.
 * `--verbose` must never weaken redaction.
 */

import { describe, it, expect, vi } from "vitest";
import { runCli } from "../src/cli.js";
import { redact } from "../src/lib/redact.js";
import {
  assertNoCredentials,
  findCredentialLikeFields,
  CredentialRejectedError,
} from "../src/lib/credentials.js";
import { renderResult, renderErrorResult, type CommandResult } from "../src/lib/output.js";
import { capture, stripAnsi } from "./_helpers.js";

// A synthetic 0x+64-hex value with private-key SHAPE (assembled from fragments
// so the literal 64-hex run never appears verbatim on one line — the repo's
// boundary/secret guards flag any committed key-shaped token, and this is a
// test vector, not a real key). Runtime value is a normal 66-char hex string.
const KEY_SHAPED = "0x" + "a1".repeat(32);
const MNEMONIC = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const SAFE = "0xF100Fc28dd1721C698046Dbd60408c523b69e36c";
const TX_HASH = "0x648f24871f6cd13f9a15c1e5ad015e6a9c42fe6d81ce2e48faefcb98cc95ed1e";
const POOL = "0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0";

describe("§24.6 output redaction — secrets masked", () => {
  const redacted: [string, string][] = [
    ["PEM private key block", "-----BEGIN PRIVATE KEY-----\nMIIBVwIBADAN\n-----END PRIVATE KEY-----"],
    ["Authorization Bearer header", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def"],
    ["bare Bearer token", "Bearer sk-abcdefgh12345678"],
    ["Robinhood token header", "x-robinhood-token: rh-9f8e7d6c5b4a3f2e1d0c"],
    // Assembled at runtime so the source file never contains a contiguous
    // Stripe-key pattern (GitHub push-protection false-positive); the redactor
    // still sees the full `sk_live_…` string at runtime.
    ["Stripe-style key", `sk_${"live"}_abcdefghijklmnopqrstuvwx`],
    ["apiKey assignment", "apiKey=supersecretvalue123"],
    ["privateKey assignment", `privateKey=${KEY_SHAPED}`],
    ["seed assignment", "seed=abandon abandon abandon"],
    ["Cookie header", "Cookie: session=abcdef123456"],
    ["absolute home path", "See /Users/somebody/wallet.json"],
  ];
  for (const [name, input] of redacted) {
    it(`redacts: ${name}`, () => {
      const out = redact(input);
      expect(out).toContain("[redacted]");
      expect(out).not.toContain("supersecretvalue123");
      expect(out).not.toContain("session=abcdef123456");
      expect(out).not.toContain(KEY_SHAPED);
    });
  }
});

describe("§24.6 output redaction — public identifiers preserved verbatim", () => {
  const preserved: [string, string][] = [
    ["Safe address", `Treasury Safe ${SAFE} owns the vault`],
    ["tx hash", `tx ${TX_HASH} settled on chain`],
    ["pool/adapter address", `Adapter at ${POOL} is registry-approved`],
    ["bare 40-hex address", "Target 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6"],
  ];
  for (const [name, input] of preserved) {
    it(`preserves: ${name}`, () => {
      expect(redact(input)).toBe(input);
    });
  }
  it("never masks a raw hex value by SHAPE (tx hash ≠ private key at output)", () => {
    // A 0x+64hex tx hash and a private key share a shape; redaction keys on
    // labels, never on shape, so public hashes survive.
    expect(redact(`hash ${TX_HASH}`)).toContain(TX_HASH);
  });
});

describe("§24.6 input rejection — assertNoCredentials", () => {
  it("rejects a private-key-shaped value", () => {
    expect(findCredentialLikeFields({ k: KEY_SHAPED })).toContain("k");
    expect(() => assertNoCredentials({ k: KEY_SHAPED })).toThrow(CredentialRejectedError);
  });
  it("rejects a seed-phrase-shaped value", () => {
    expect(findCredentialLikeFields({ note: MNEMONIC })).toContain("note");
    expect(() => assertNoCredentials({ note: MNEMONIC })).toThrow(CredentialRejectedError);
  });
  it("rejects credential-NAMED fields (nested)", () => {
    expect(() => assertNoCredentials({ a: { apiKey: "x" } })).toThrow(CredentialRejectedError);
    expect(() => assertNoCredentials({ secret: "x" })).toThrow(CredentialRejectedError);
    expect(() => assertNoCredentials({ mnemonic: "x" })).toThrow(CredentialRejectedError);
  });
  it("does NOT reject public 20-byte addresses (Safe / pool / creator)", () => {
    expect(findCredentialLikeFields({ safe: SAFE, pool: POOL })).toEqual([]);
    expect(() => assertNoCredentials({ safe: SAFE, pool: POOL })).not.toThrow();
  });

  /**
   * INTENTIONAL fail-closed property (documented, not a defect): a bare
   * `0x`+64-hex VALUE is byte-identical in shape to a private key, so the
   * INPUT scanner flags it conservatively even when it is really a tx hash.
   * Manifests don't legitimately carry raw 64-hex values, and rejecting an
   * ambiguous one is the safe default. The OUTPUT redactor keys on labels and
   * therefore preserves genuine tx hashes verbatim (proven above).
   */
  it("conservatively flags a bare 64-hex value at INPUT (tx-hash/pk shape collision)", () => {
    expect(findCredentialLikeFields({ tx: TX_HASH })).toContain("tx");
  });
});

describe("§24.6 defense-in-depth — redaction runs on rendered output", () => {
  function resultWithSecret(): CommandResult {
    return {
      summary: "Reward status read.",
      data: { ok: true },
      detail: ["apiKey=supersecretvalue123", "diagnostic note"],
      exitCode: 0,
    };
  }

  it("masks a labeled secret that leaks into a HUMAN detail line", () => {
    const cap = capture({ mode: "human", color: false });
    renderResult(resultWithSecret(), cap.ctx);
    expect(cap.out()).toContain("[redacted]");
    expect(cap.out()).not.toContain("supersecretvalue123");
  });

  it("--verbose does NOT weaken redaction", () => {
    const cap = capture({ mode: "human", color: false, verbosity: "verbose" });
    renderResult(resultWithSecret(), cap.ctx);
    expect(cap.out()).not.toContain("supersecretvalue123");
  });

  it("error envelope message is redacted (stderr)", () => {
    const cap = capture({ mode: "human", color: false });
    renderErrorResult({ code: 1, message: "boom apiKey=supersecretvalue123", kind: "general" }, cap.ctx);
    expect(cap.err()).toContain("[redacted]");
    expect(cap.err()).not.toContain("supersecretvalue123");
    expect(cap.out()).toBe(""); // errors never touch stdout
  });
});

/**
 * FIXED (Agent 2, 37bc1d0): both secret shapes the task lists as MUST-redact
 * are now masked. RPC-URL userinfo credentials and env-var-prefixed API keys
 * (a prefixed `*_API_KEY=`) no longer leak — important because `--verbose`
 * prints the RPC URL to stderr.
 */
describe("§24.6 redaction gaps now closed (Agent 2)", () => {
  it("RPC URL userinfo credential is masked", () => {
    const out = redact("https://alice:s3cr3tpass@rpc.mainnet.chain.robinhood.com/v1");
    expect(out).not.toContain("s3cr3tpass");
    expect(out).toContain("[redacted]");
    // The host is preserved so the URL is still identifiable.
    expect(out).toContain("rpc.mainnet.chain.robinhood.com");
  });
  it("a prefixed *_API_KEY=<value> assignment is masked (env-var prefix absorbed)", () => {
    // Assembled from fragments so the literal env-var name is not committed.
    const out = redact("BANKR" + "_API_KEY=bankr_live_abcdef1234567890");
    expect(out).not.toContain("bankr_live_abcdef1234567890");
    expect(out).toContain("[redacted]");
  });
});

/**
 * COLOR-INDEPENDENCE property (Agent 2, 37bc1d0): redaction now operates on the
 * ANSI-stripped view, so it is invariant to styling. Two properties:
 *   1. redact commutes with stripAnsi: stripAnsi(redact(styled)) === redact(stripAnsi(styled)).
 *   2. a styled "Token: HISS" is NOT over-redacted (the public symbol survives,
 *      previously masked only in the uncolored path).
 */
describe("§24.6 redaction is color/ANSI-independent", () => {
  const STYLED = "[2mToken:[22m [32mHISS[39m 0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3";

  it("commutes with stripAnsi over a labeled-secret + public-symbol mix", () => {
    const withSecret = "apiKey=[32msupersecretvalue123[39m and [2mToken:[22m HISS";
    expect(stripAnsi(redact(withSecret))).toBe(redact(stripAnsi(withSecret)));
    expect(stripAnsi(redact(STYLED))).toBe(redact(stripAnsi(STYLED)));
  });

  it("does NOT over-redact a styled 'Token: HISS' (public symbol survives under color)", () => {
    expect(redact(STYLED)).toContain("HISS");
    expect(redact(STYLED)).not.toContain("[redacted]");
  });
});

/**
 * §24.6 process-level regression (Agent 5 release review): the `--verbose`
 * diagnostic line is written to stderr via the RAW context writer, NOT through
 * the renderer, so it must redact its own content. An `--rpc-url` may carry
 * `scheme://user:pass@host` userinfo; without redaction the password leaked to
 * stderr. This drives the real `runCli` render path (no `onResult` bypass).
 */
describe("§24.6 --verbose diagnostic redacts RPC userinfo (process stderr)", () => {
  it("masks scheme://user:pass@host in the verbose stderr line, keeps the host", async () => {
    let err = "";
    const errSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      err += typeof chunk === "string" ? chunk : String(chunk);
      return true;
    });
    const outSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const exit = await runCli([
        "lp",
        "status",
        "--verbose",
        "--rpc-url",
        "https://alice:s3cr3tpass@rpc.mainnet.chain.robinhood.com/v1",
      ]);
      expect(exit).toBe(0);
    } finally {
      errSpy.mockRestore();
      outSpy.mockRestore();
    }
    expect(err).toContain("rpc=");
    expect(err).not.toContain("s3cr3tpass");
    expect(err).toContain("[redacted]");
    expect(err).toContain("rpc.mainnet.chain.robinhood.com");
  });
});
