/**
 * contracts:test — runs the Foundry test suite when a Foundry project and the
 * `forge` toolchain are both present; otherwise it prints a clear message and
 * exits 0.
 *
 * The public repo ships contract ABIs and (optionally) sources. Foundry is not
 * required to work with the TypeScript packages, so its absence must not break
 * CI — it is announced, not failed.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./lib/walk.ts";

function hasForge(): boolean {
  const probe = spawnSync("forge", ["--version"], { stdio: "ignore" });
  return probe.status === 0;
}

function main(): void {
  const foundryConfig = join(REPO_ROOT, "contracts", "foundry.toml");
  const rootFoundryConfig = join(REPO_ROOT, "foundry.toml");
  const configPath = existsSync(foundryConfig)
    ? foundryConfig
    : existsSync(rootFoundryConfig)
      ? rootFoundryConfig
      : null;

  if (!configPath) {
    console.log(
      "contracts:test — no foundry.toml found; skipping (no-op). Contract ABIs are shipped as JSON.",
    );
    return;
  }

  if (!hasForge()) {
    console.log(
      "contracts:test — foundry.toml present but `forge` is not installed; skipping. " +
        "Install Foundry (https://getfoundry.sh) to run the Solidity tests locally.",
    );
    return;
  }

  const cwd = configPath === foundryConfig ? join(REPO_ROOT, "contracts") : REPO_ROOT;
  console.log(`contracts:test — running \`forge test\` in ${cwd}…`);
  const res = spawnSync("forge", ["test", "-vvv"], { cwd, stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`\ncontracts:test FAILED (forge exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
  console.log("contracts:test OK");
}

main();
