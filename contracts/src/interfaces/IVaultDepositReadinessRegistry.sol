// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultDepositReadinessRegistry
/// @notice Public interface for the HISS VaultDepositReadinessRegistry on
///         Robinhood Chain (4663) — the factory's ACTIVE deposit gate. A vault
///         is deposit-ready only when it is a marked candidate with both deposit
///         terms and audit readiness set, and not blocked. The gate ships CLOSED
///         (defaultReady=false, zero vaults marked ready): a missing mark reads
///         as not-ready, never as ready.
/// @dev Authored from the verified on-chain ABI. Readiness is always a live read.
interface IVaultDepositReadinessRegistry {
    /// @notice Deposit-readiness axes for a vault.
    struct DepositReadiness {
        bool candidate;
        bool depositTermsReady;
        bool auditReady;
        bool blocked;
    }

    /// @notice Legacy readiness view retained for compatibility.
    struct Readiness {
        bool candidate;
        bool legalReady;
        bool auditReady;
        bool jurisdictionReady;
    }

    function markVaultCandidate(address vault) external;
    function markDepositTermsReady(address vault) external;
    function markAuditReady(address vault) external;
    function revokeDepositTermsReady(address vault) external;
    function revokeAuditReady(address vault) external;
    function blockVault(address vault) external;
    function unblockVault(address vault) external;
    function setDefaultReady(bool defaultReady_) external;

    function getDepositReadiness(address vault) external view returns (DepositReadiness memory);
    function getReadiness(address vault) external view returns (Readiness memory);
    function isDepositReady(address vault) external view returns (bool);
    function isLegalReady(address vault) external view returns (bool);
    function defaultReady() external view returns (bool);

    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
