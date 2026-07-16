// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultReceiptRegistry
/// @notice Public interface for the HISS VaultReceiptRegistry on Robinhood Chain
///         (4663). Vaults record content-addressed receipt hashes (vault actions
///         and rebalance receipts) here so third parties can attribute a receipt
///         hash back to the emitting vault. Only factory-known vaults may record.
/// @dev Authored from the verified on-chain ABI.
interface IVaultReceiptRegistry {
    /// @param kind Receipt category tag (e.g. vault receipt vs. rebalance receipt).
    event VaultReceiptRecorded(address indexed vault, bytes32 indexed receiptHash, uint8 kind);

    function recordVaultReceiptHash(bytes32 receiptHash) external;
    function recordRebalanceReceiptHash(bytes32 receiptHash) external;

    function factory() external view returns (address);
    function vaultOf(bytes32 receiptHash) external view returns (address);
    function receiptsOf(address vault) external view returns (bytes32[] memory);
    function receiptCountOf(address vault) external view returns (uint256);
}
