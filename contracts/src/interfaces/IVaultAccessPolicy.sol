// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultAccessPolicy
/// @notice Public interface for the HISS VaultAccessPolicy on Robinhood Chain
///         (4663). Holds per-vault access rules (US-persons restriction and the
///         required risk / jurisdiction acknowledgement hashes) and gates each
///         deposit via checkDeposit. Facts-only: acknowledgement is a hash the
///         depositor supplies; no PnL or performance input is ever consulted.
/// @dev Authored from the verified on-chain ABI.
interface IVaultAccessPolicy {
    /// @notice Per-vault access policy record.
    struct VaultPolicy {
        bool usPersonsRestricted;
        bytes32 requiredRiskAckHash;
        bytes32 requiredJurisdictionAckHash;
        bool exists;
    }

    event AccessPolicySet(
        address indexed vault,
        bool usPersonsRestricted,
        bytes32 requiredRiskAckHash,
        bytes32 requiredJurisdictionAckHash
    );
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Reverts if the depositor does not satisfy the vault's policy.
    function checkDeposit(
        address vault,
        address depositor,
        bytes32 riskAckHash,
        bytes32 jurisdictionAckHash
    ) external view;

    function setVaultPolicy(
        address vault,
        bool usPersonsRestricted,
        bytes32 requiredRiskAckHash,
        bytes32 requiredJurisdictionAckHash
    ) external;

    function getVaultPolicy(address vault) external view returns (VaultPolicy memory);
    function factory() external view returns (address);

    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
