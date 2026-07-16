// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultAssetRegistry
/// @notice Public interface for the HISS VaultAssetRegistry on Robinhood Chain
///         (4663). The registry is the allow-list truth for vault-holdable
///         assets (oracle feed, max allocation, staleness bound) and for the
///         rebalance adapters vaults may route through. Nothing is live by
///         default: assets enable only after readiness, and live rebalance is a
///         separate flag per asset.
/// @dev Authored from the verified on-chain ABI.
interface IVaultAssetRegistry {
    /// @notice Per-asset policy record.
    struct AssetPolicy {
        bool enabled;
        bool liveRebalanceEnabled;
        uint16 maxAllocationBps;
        address oracleFeed;
        uint64 stalenessLimitSeconds;
        bool exists;
    }

    event AssetRegistered(
        address indexed token,
        address indexed oracleFeed,
        uint16 maxAllocationBps,
        uint64 stalenessLimitSeconds
    );
    event AssetStatusChanged(address indexed token, bool enabled, bool liveRebalanceEnabled);
    event AdapterApprovalSet(address indexed adapter, bool approved);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function registerAsset(
        address token,
        address oracleFeed,
        uint16 maxAllocationBps,
        uint64 stalenessLimitSeconds
    ) external;
    function enableAssetAfterReadiness(address token) external;
    function disableAsset(address token) external;
    function setAdapterApproval(address adapter, bool approved) external;

    function getAssetPolicy(address token) external view returns (AssetPolicy memory);
    function isEnabled(address token) external view returns (bool);
    function isLiveRebalanceEnabled(address token) external view returns (bool);
    function isApprovedAdapter(address adapter) external view returns (bool);
    function assetList(uint256 index) external view returns (address);
    function assetCount() external view returns (uint256);

    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
