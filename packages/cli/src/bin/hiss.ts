#!/usr/bin/env node
/**
 * `hiss` binary entrypoint. Read-and-prepare only — this CLI never signs,
 * submits, or holds keys.
 */

import { runCli } from "../cli.js";

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`hiss: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
