#!/usr/bin/env node
/**
 * Emit `dist/build-info.json` — deterministic provenance/source-SHA metadata
 * that `release:verify` asserts and that ships in the published tarball.
 *
 * The SHA and build timestamp are derived from the git HEAD commit (NOT
 * wall-clock time) so the artifact is reproducible for a given commit. Full
 * cryptographic provenance is attached separately at publish time by npm's
 * `--provenance` (OIDC) — this file is the in-tarball, offline-verifiable
 * pointer back to the exact source commit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "package.json");
const outPath = join(here, "..", "dist", "build-info.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

function git(args) {
  try {
    return execFileSync("git", args, { cwd: here, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const sourceSha = git(["rev-parse", "HEAD"]);
const commitDate = git(["log", "-1", "--format=%cI"]);
const shortSha = sourceSha ? sourceSha.slice(0, 12) : null;

const info = {
  name: pkg.name,
  version: pkg.version,
  bundler: "tsup",
  sourceSha,
  shortSha,
  commitDate,
  repository: pkg.repository?.url ?? null,
  note: "Cryptographic build provenance is attached at publish time via npm --provenance (OIDC). This file is the in-tarball pointer to the exact source commit.",
};

writeFileSync(outPath, JSON.stringify(info, null, 2) + "\n");
process.stdout.write(`build-info.json → version ${info.version} · sha ${shortSha ?? "(no git)"}\n`);
