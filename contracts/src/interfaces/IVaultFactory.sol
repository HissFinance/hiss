// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultFactory
/// @notice Public interface for the HISS VaultFactory on Robinhood Chain (4663).
///         The factory deploys USDG Creator Vaults (HissUsdGVault clones), wires
///         them to the shared registry/policy/fee satellites, and enforces the
///         protocol-level fee caps and minimum creator-skin bounds.
/// @dev Authored from the verified on-chain ABI. Deposit/readiness state and
///      ownership are always live chain reads — never inferred from this file.
interface IVaultFactory {
    /// @notice Parameters accepted by createVault / createVerifiedVault.
    struct VaultParams {
        string name;
        string symbol;
        address feeRecipient;
        address referral;
        uint16 referralBps;
        uint16 performanceFeeBps;
        uint32 lockupSeconds;
        uint16 minSkinBps;
        bytes32 strategyHash;
        uint32 strategyNoticePeriod;
        bool usPersonsRestricted;
        bytes32 requiredRiskAckHash;
        bytes32 requiredJurisdictionAckHash;
    }

    event VaultCreated(
        address indexed vault,
        address indexed creator,
        bytes32 strategyHash,
        uint16 performanceFeeBps,
        bool verified
    );
    event VaultMetadataRegistered(address indexed vault, bytes32 metadataHash);
    event VaultFeeConfigSet(
        uint256 creationFeeUsdg,
        uint16 performanceFeeCapBps,
        uint16 protocolShareBps,
        uint16 routingFeeTenthBps,
        uint16 minCreatorSkinBps
    );
    event VaultWiringSet(address feeDistributor, address receiptRegistry, address accessPolicy);
    event VaultImplementationSet(address indexed implementation);
    event LegalReadinessRegistrySet(address indexed registry);
    event ProtocolTreasuryUpdated(address indexed treasury);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Vault creation ---
    function createVault(VaultParams calldata params) external returns (address vault);
    function createVerifiedVault(VaultParams calldata params, address vaultCreator) external returns (address vault);
    function collectCreationFee(address payer) external;
    function registerVaultMetadata(address vault, bytes32 metadataHash) external;

    // --- Registry views ---
    function allVaults(uint256 index) external view returns (address);
    function vaultCount() external view returns (uint256);
    function isVault(address vault) external view returns (bool);
    function isVerifiedVault(address vault) external view returns (bool);
    function vaultMetadataHash(address vault) external view returns (bytes32);

    // --- Wiring / satellites ---
    function accessPolicy() external view returns (address);
    function assetRegistry() external view returns (address);
    function feeDistributor() external view returns (address);
    function legalReadinessRegistry() external view returns (address);
    function oracleAdapter() external view returns (address);
    function receiptRegistry() external view returns (address);
    function usdg() external view returns (address);
    function vaultImplementation() external view returns (address);
    function protocolTreasury() external view returns (address);

    // --- Fee configuration ---
    function creationFeeUsdg() external view returns (uint256);
    function performanceFeeCapBps() external view returns (uint16);
    function protocolShareBps() external view returns (uint16);
    function routingFeeTenthBps() external view returns (uint16);
    function minCreatorSkinBps() external view returns (uint16);

    // --- Bounds (immutable) ---
    function MAX_PERFORMANCE_FEE_BPS() external view returns (uint16);
    function MAX_PROTOCOL_SHARE_BPS() external view returns (uint16);
    function MAX_REFERRAL_BPS() external view returns (uint16);
    function MAX_ROUTING_FEE_TENTH_BPS() external view returns (uint16);
    function MIN_CREATOR_SKIN_BPS() external view returns (uint16);
    function MIN_ROUTING_FEE_TENTH_BPS() external view returns (uint16);
    function ROBINHOOD_CHAIN_ID() external view returns (uint256);
    function ROBINHOOD_CHAIN_TESTNET_ID() external view returns (uint256);

    // --- Admin (two-step ownable) ---
    function setFeeCaps(
        uint256 creationFeeUsdg_,
        uint16 performanceFeeCapBps_,
        uint16 protocolShareBps_,
        uint16 routingFeeTenthBps_,
        uint16 minCreatorSkinBps_
    ) external;
    function setLegalReadinessRegistry(address registry) external;
    function setProtocolTreasury(address treasury) external;
    function setVaultImplementation(address implementation) external;
    function setWiring(
        address feeDistributor_,
        address receiptRegistry_,
        address accessPolicy_,
        address legalReadinessRegistry_
    ) external;
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
