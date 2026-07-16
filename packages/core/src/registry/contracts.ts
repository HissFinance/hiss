// SPDX-License-Identifier: Apache-2.0
/**
 * Canonical public contract registry for HISS Finance on Robinhood Chain
 * mainnet (4663).
 *
 * Every address is stored in its EIP-55 checksummed form. These are the
 * deployed, publicly-verifiable contracts and accounts; nothing here is a
 * secret. Resolve by key with {@link getContractAddress}; the registry is the
 * single public source of truth for addresses.
 */

import { ROBINHOOD_CHAIN_MAINNET_ID, type RobinhoodChainId } from "../chain/config.js";
import { isChecksumAddress, type Address } from "../address/address.js";

export type ContractKey =
  | "hissToken"
  | "treasurySafe"
  | "xHissVault"
  | "vaultFactory"
  | "flagshipVault"
  | "usdg"
  | "chunkedInitcodeForwarder"
  | "hissOracleAdapter"
  | "vaultAssetRegistry"
  | "hissUsdgVault"
  | "vaultFeeDistributor"
  | "vaultReceiptRegistry"
  | "vaultAccessPolicy"
  | "vaultLegalReadinessRegistry"
  | "vaultDepositReadinessRegistry"
  | "rebalanceAdapter";

export type ContractEntry = {
  key: ContractKey;
  address: Address;
  chainId: RobinhoodChainId;
  label: string;
  category: "token" | "governance" | "staking" | "vault-core" | "vault-registry" | "adapter";
};

/** Canonical registry, chain 4663. Addresses are EIP-55 checksummed. */
export const CONTRACT_REGISTRY: Readonly<Record<ContractKey, ContractEntry>> = Object.freeze({
  hissToken: {
    key: "hissToken",
    address: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "$HISS token (ERC-20)",
    category: "token",
  },
  treasurySafe: {
    key: "treasurySafe",
    address: "0xF100Fc28dd1721C698046Dbd60408c523b69e36c",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "HISS Treasury Safe (2-of-3)",
    category: "governance",
  },
  xHissVault: {
    key: "xHissVault",
    address: "0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "xHISS staking vault",
    category: "staking",
  },
  vaultFactory: {
    key: "vaultFactory",
    address: "0x278d237c6890a5f7101296a9021ed9D26c821810",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultFactory",
    category: "vault-core",
  },
  flagshipVault: {
    key: "flagshipVault",
    address: "0x6D962604dF1c6C5ef4B59d88863600Fe71Bb63E6",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "HISS Vault (flagship USDG Creator Vault)",
    category: "vault-core",
  },
  usdg: {
    key: "usdg",
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "USDG (Global Dollar) — vault base asset, 6 decimals",
    category: "token",
  },
  chunkedInitcodeForwarder: {
    key: "chunkedInitcodeForwarder",
    address: "0x8040827cE112A719ECe8c114e457A9f95856A0Ba",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "ChunkedInitcodeForwarder",
    category: "adapter",
  },
  hissOracleAdapter: {
    key: "hissOracleAdapter",
    address: "0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "HissOracleAdapter",
    category: "adapter",
  },
  vaultAssetRegistry: {
    key: "vaultAssetRegistry",
    address: "0xcf9609B30f565813b87d1998c8b3b2aD073a4cE1",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultAssetRegistry",
    category: "vault-registry",
  },
  hissUsdgVault: {
    key: "hissUsdgVault",
    address: "0xb3b6CE5b1C6605dBE897555DdaA191c2AF0A7D10",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "HissUsdGVault",
    category: "vault-core",
  },
  vaultFeeDistributor: {
    key: "vaultFeeDistributor",
    address: "0x354686dD8480aF9bBa590dbA8D900C9b8055C71B",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultFeeDistributor",
    category: "vault-core",
  },
  vaultReceiptRegistry: {
    key: "vaultReceiptRegistry",
    address: "0x379dAaA0B7bb172A67f37a9bC53E42Ec8C9af170",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultReceiptRegistry",
    category: "vault-registry",
  },
  vaultAccessPolicy: {
    key: "vaultAccessPolicy",
    address: "0x7e292bCD2C7A3420dA4a7036B99CFf32BcF9B663",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultAccessPolicy",
    category: "vault-registry",
  },
  vaultLegalReadinessRegistry: {
    key: "vaultLegalReadinessRegistry",
    address: "0x31E4ECF99C993dfd1887E30dBa07c813BCe23e97",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultLegalReadinessRegistry (predecessor deposit gate)",
    category: "vault-registry",
  },
  vaultDepositReadinessRegistry: {
    key: "vaultDepositReadinessRegistry",
    address: "0x2Bb41af03d2080896f0F6e5fb85136f7d7a34BFb",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "VaultDepositReadinessRegistry (active deposit gate; ships CLOSED)",
    category: "vault-registry",
  },
  rebalanceAdapter: {
    key: "rebalanceAdapter",
    address: "0xd9a097d2e119FDcd7A22E6F4b85C26E437419A15",
    chainId: ROBINHOOD_CHAIN_MAINNET_ID,
    label: "Rebalance adapter (registry-approved)",
    category: "adapter",
  },
});

/** The Treasury Safe owner set (2-of-3), EIP-55 checksummed. */
export const TREASURY_SAFE_OWNERS: readonly Address[] = Object.freeze([
  "0x80c61255F03e09a26Dc725F186cc1bD3B9C897cC",
  "0x403BAD53F39a74154a1C9a86852E443738328761",
  "0x21DA3E2EB2e2Ecc1Fdb131466212B4D7a108CDD3",
]);

export const TREASURY_SAFE_THRESHOLD = 2 as const;
export const TREASURY_SAFE_OWNER_COUNT = 3 as const;

/** Resolve a contract address by key. Throws on an unknown key. */
export function getContractAddress(key: ContractKey): Address {
  const entry = CONTRACT_REGISTRY[key];
  if (!entry) throw new Error(`unknown contract key: ${key}`);
  return entry.address;
}

/** Resolve a full contract entry by key. Throws on an unknown key. */
export function getContract(key: ContractKey): ContractEntry {
  const entry = CONTRACT_REGISTRY[key];
  if (!entry) throw new Error(`unknown contract key: ${key}`);
  return entry;
}

/** Reverse lookup by address (case-insensitive). Undefined if not registered. */
export function findContractByAddress(address: string): ContractEntry | undefined {
  const needle = address.toLowerCase();
  return Object.values(CONTRACT_REGISTRY).find((e) => e.address.toLowerCase() === needle);
}

/** Every registered address carries a valid EIP-55 checksum. */
export function allRegistryAddressesChecksummed(): boolean {
  const contracts = Object.values(CONTRACT_REGISTRY).every((e) => isChecksumAddress(e.address));
  const owners = TREASURY_SAFE_OWNERS.every((a) => isChecksumAddress(a));
  return contracts && owners;
}
