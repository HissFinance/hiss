# Third-Party Licenses

HISS Finance is released under the [Apache License 2.0](./LICENSE). It builds on,
and interoperates with, third-party open-source software. This document lists the
principal third-party components and their licenses. Each dependency remains
governed by its own license; the lists below are informational.

The authoritative, machine-readable dependency set for any package is its
`package.json` (JavaScript/TypeScript) or `foundry.toml` / `remappings.txt`
(Solidity). When a component is vendored into this repository, its original
copyright header and license text are preserved in the corresponding source
files.

## Smart contract dependencies (Solidity)

| Component                                       | Typical license    | Usage                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenZeppelin Contracts                          | MIT                | Base ERC-20 / ERC-4626 building blocks, access control, `SafeERC20`, reentrancy guards, and math utilities used by the vault and staking contracts. Original MIT headers are preserved in any vendored source. |
| Safe (Safe Smart Account, formerly Gnosis Safe) | LGPL-3.0 / GPL-3.0 | The HISS Treasury is a Safe multisig deployment. HISS Finance interacts with the Safe contracts as a deployed dependency; it does not redistribute their source under this repository's license.               |
| Solmate / forge-std (testing)                   | MIT / Apache-2.0   | Test harness and utility libraries used only in the Foundry test suite.                                                                                                                                        |

> Solidity contracts that consume tokenized-equity price data interoperate with
> Chainlink price feeds and Robinhood Chain system contracts. Those on-chain
> components are external services, not source dependencies of this repository.

## JavaScript / TypeScript dependencies

The SDK, CLI, React, and MCP packages depend on widely used, permissively
licensed libraries. Representative examples:

| Component                  | Typical license | Usage                                                                             |
| -------------------------- | --------------- | --------------------------------------------------------------------------------- |
| viem                       | MIT             | Ethereum JSON-RPC client, ABI encoding, and typed contract reads used by the SDK. |
| TypeScript                 | Apache-2.0      | Language and compiler for all packages.                                           |
| Zod                        | MIT             | Runtime schema validation for manifests, fee configs, and API payloads.           |
| React                      | MIT             | UI primitives for the `@hiss-finance/react` package.                              |
| Model Context Protocol SDK | MIT             | Transport and tool plumbing for `@hiss-finance/mcp-server`.                       |
| Vitest                     | MIT             | Unit and property test runner.                                                    |

The exact versions and the complete transitive dependency tree are pinned in each
package's lockfile. To regenerate a full license inventory locally, use a license
scanner of your choice against the installed dependency tree (for example,
`pnpm licenses list`).

## Trademarks

"Robinhood" and "Robinhood Chain" are trademarks of Robinhood Markets, Inc.
"Chainlink" is a trademark of Chainlink Labs. "Uniswap" is a trademark of Uniswap
Labs. "Bankr" and "Doppler" are the marks of their respective owners. These marks
are used solely to describe interoperability and are not claims of affiliation or
endorsement.

## Reporting a licensing issue

If you believe a third-party component is missing from this list, is misattributed,
or is used in a way inconsistent with its license, please open an issue or, for
sensitive matters, follow the process in [SECURITY.md](./SECURITY.md).
