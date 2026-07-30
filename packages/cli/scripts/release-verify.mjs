#!/usr/bin/env node
/**
 * release:verify — the pre-publish gate for `@hiss-finance/cli`.
 *
 * FAILS (non-zero exit) when any of the following is true:
 *   - dist/ is absent, or the bin/library entry is missing.
 *   - the bin does not start with a `#!/usr/bin/env node` shebang.
 *   - the bin is not executable (no exec bit after build/install).
 *   - the runtime bundle still requires TS source or an unpublished
 *     `@hiss-finance/*` / `workspace:*` package (bundling failed).
 *   - the published `dependencies` contain a workspace/internal package.
 *   - private/operator material, credentials, or OpenClaw refs are present in
 *     any packable file.
 *   - `hiss --version` does not equal the package version.
 *   - an offline `--json` command emits ANSI on stdout, or invalid JSON.
 *   - the packed tarball exceeds the approved size budget.
 *   - LICENSE is missing, or provenance/source-SHA metadata is absent.
 *
 * Read-only: never mutates package.json, never bumps versions, never publishes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdtempSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const distDir = join(pkgDir, "dist");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

// ---- Approved budgets ------------------------------------------------------
const MAX_PACKED_BYTES = 400 * 1024; // 400 KB gzipped tarball
const MAX_UNPACKED_BYTES = 1_500 * 1024; // 1.5 MB unpacked

const results = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "ok" });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// Files that WILL be published (the `files` closure), for content scanning.
function packableFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  if (existsSync(distDir)) walk(distDir);
  for (const f of ["README.md", "LICENSE", "package.json"]) {
    const p = join(pkgDir, f);
    if (existsSync(p)) out.push(p);
  }
  return out;
}

// ---- 1. dist + entries exist ----------------------------------------------
check("dist present", () => {
  assert(existsSync(distDir), "dist/ is absent — run the build first");
  return distDir;
});
const binPath = join(distDir, "bin", "hiss.js");
check("bin entry present", () => {
  assert(existsSync(binPath), `bin target missing: ${binPath}`);
  assert(pkg.bin?.hiss === "./dist/bin/hiss.js", `package.json bin.hiss must be ./dist/bin/hiss.js`);
  return binPath;
});
check("library entry present", () => {
  const idx = join(distDir, "index.js");
  assert(existsSync(idx), "dist/index.js missing");
  assert(existsSync(join(distDir, "index.d.ts")), "dist/index.d.ts missing");
  return idx;
});

// ---- 2. shebang -----------------------------------------------------------
check("shebang", () => {
  const first = readFileSync(binPath, "utf8").split("\n", 1)[0];
  assert(first === "#!/usr/bin/env node", `bin first line is not the node shebang: ${JSON.stringify(first)}`);
  return first;
});

// ---- 3. executable bit ----------------------------------------------------
check("bin executable", () => {
  const mode = statSync(binPath).mode;
  assert((mode & 0o111) !== 0, "bin is not executable (no exec bit); npm would install a non-runnable bin");
  return "0o" + (mode & 0o777).toString(8);
});

// ---- 4. no TS source / unpublished dep required at runtime ----------------
check("no runtime TS/workspace deps", () => {
  const jsFiles = packableFiles().filter((f) => f.endsWith(".js"));
  const offenders = [];
  for (const f of jsFiles) {
    const src = readFileSync(f, "utf8");
    // A bundled artifact must not import from an unpublished internal package
    // nor from a raw .ts specifier.
    if (/from\s+["']@hiss-finance\//.test(src) || /require\(\s*["']@hiss-finance\//.test(src)) {
      offenders.push(`${f}: imports an unbundled @hiss-finance/* package`);
    }
    if (/from\s+["'][^"']+\.ts["']/.test(src)) {
      offenders.push(`${f}: imports a raw .ts source path`);
    }
    if (/workspace:\*/.test(src)) offenders.push(`${f}: contains workspace:* specifier`);
  }
  assert(offenders.length === 0, offenders.join("; "));
  return `${jsFiles.length} js files clean`;
});

// ---- 5. published dependencies are resolvable (no workspace/internal) ------
check("published deps resolvable", () => {
  const deps = pkg.dependencies ?? {};
  const bad = Object.entries(deps).filter(
    ([n, v]) => n.startsWith("@hiss-finance/") || String(v).startsWith("workspace:"),
  );
  assert(
    bad.length === 0,
    `dependencies contain unpublished/workspace refs: ${bad.map(([n]) => n).join(", ")}`,
  );
  return Object.keys(deps).join(", ") || "(none)";
});

// ---- 6. no private material / credentials / OpenClaw ----------------------
check("no private material", () => {
  const patterns = [
    [/openclaw/i, "OpenClaw reference"],
    [/bankr[_-]?api[_-]?key/i, "Bankr API key reference"],
    [/ai\.bankr\.hiss/i, "Bankr keychain service"],
    [/hissfinance@proton\.me/i, "operator email"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "PEM private key"],
    [/\bxpub[A-Za-z0-9]{20,}/, "extended public key"],
    [/\b(seed phrase|mnemonic phrase)\b/i, "mnemonic/seed material"],
    [/security\/with-hiss-bankr-key/i, "operator secret wrapper path"],
  ];
  const offenders = [];
  for (const f of packableFiles()) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue; // binary/unreadable — skip
    }
    for (const [re, label] of patterns) {
      if (re.test(src)) offenders.push(`${label} in ${f}`);
    }
  }
  assert(offenders.length === 0, offenders.join("; "));
  return "no operator/credential/OpenClaw material";
});

// ---- 7. --version parity --------------------------------------------------
check("version parity", () => {
  const out = execFileSync(process.execPath, [binPath, "--version"], { encoding: "utf8" }).trim();
  assert(out === pkg.version, `hiss --version (${out}) != package version (${pkg.version})`);
  return out;
});

// ---- 8. offline --json is valid + ANSI-free -------------------------------
check("json is ansi-free", () => {
  const out = execFileSync(process.execPath, [binPath, "agentic", "status", "--json"], {
    encoding: "utf8",
  });
  assert(!/\x1b\[/.test(out), "JSON stdout contains ANSI escape codes");
  const parsed = JSON.parse(out); // throws if invalid
  assert(parsed && typeof parsed === "object", "JSON envelope is not an object");
  return "valid JSON, no ANSI";
});

// ---- 9. license present ---------------------------------------------------
check("license present", () => {
  assert(existsSync(join(pkgDir, "LICENSE")), "LICENSE file missing");
  assert((pkg.files ?? []).includes("LICENSE"), "LICENSE not in package.json files[]");
  assert(pkg.license === "Apache-2.0", `unexpected license: ${pkg.license}`);
  return pkg.license;
});

// ---- 10. provenance / source-SHA metadata ---------------------------------
check("provenance metadata", () => {
  const infoPath = join(distDir, "build-info.json");
  assert(existsSync(infoPath), "dist/build-info.json (source-SHA metadata) is absent");
  const info = JSON.parse(readFileSync(infoPath, "utf8"));
  assert(info.version === pkg.version, `build-info version ${info.version} != package ${pkg.version}`);
  assert(typeof info.sourceSha === "string" && info.sourceSha.length >= 7, "build-info.sourceSha missing");
  assert(pkg.repository?.url?.includes("HissFinance/hiss"), "repository must point at HissFinance/hiss");
  return `sha ${info.shortSha}`;
});

// ---- 11. size budget ------------------------------------------------------
check("size budget", () => {
  const dest = mkdtempSync(join(tmpdir(), "hiss-verify-"));
  // Measure the CURRENT dist without re-triggering prepack. Use `npm pack`
  // (portable --ignore-scripts + --pack-destination support across the pnpm/npm
  // versions in CI; `pnpm pack --ignore-scripts` is not a valid flag combo).
  execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", dest], {
    cwd: pkgDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const tgz = readdirSync(dest).find((f) => f.endsWith(".tgz"));
  assert(tgz, "npm pack produced no tarball");
  const tgzPath = join(dest, tgz);
  const packed = statSync(tgzPath).size;
  const listing = execFileSync("tar", ["-tzvf", tgzPath], { encoding: "utf8" });
  let unpacked = 0;
  for (const line of listing.trim().split("\n")) {
    const cols = line.trim().split(/\s+/);
    const n = Number(cols[4]);
    if (Number.isFinite(n)) unpacked += n;
  }
  assert(packed <= MAX_PACKED_BYTES, `packed ${packed}B exceeds budget ${MAX_PACKED_BYTES}B`);
  assert(unpacked <= MAX_UNPACKED_BYTES, `unpacked ${unpacked}B exceeds budget ${MAX_UNPACKED_BYTES}B`);
  return `packed ${(packed / 1024).toFixed(1)}KB / unpacked ${(unpacked / 1024).toFixed(1)}KB`;
});

// ---- report ---------------------------------------------------------------
let failed = 0;
process.stdout.write("\nrelease:verify — @hiss-finance/cli@" + pkg.version + "\n");
for (const r of results) {
  if (!r.ok) failed += 1;
  process.stdout.write(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}\n`);
}
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed.\n`);
if (failed > 0) {
  process.stdout.write(`release:verify FAILED (${failed}).\n`);
  process.exit(1);
}
process.stdout.write("release:verify PASSED.\n");
