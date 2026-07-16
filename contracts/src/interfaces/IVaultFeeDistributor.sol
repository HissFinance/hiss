// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IVaultFeeDistributor
/// @notice Public interface for the HISS VaultFeeDistributor on Robinhood Chain
///         (4663). Splits a vault's crystallized fee between the fee recipient,
///         an optional referral, and the protocol treasury. HISS vaults forbid
///         AUM/execution fees — only creator-configured performance fees, capped
///         at the factory level, flow through here.
/// @dev Authored from the verified on-chain ABI.
interface IVaultFeeDistributor {
    /// @return recipientAmount Amount routed to the vault fee recipient.
    /// @return referralAmount Amount routed to the referral (if any).
    /// @return protocolAmount Amount routed to the protocol treasury.
    function distribute(
        address feeRecipient,
        address referral,
        uint16 referralBps
    ) external returns (uint256 recipientAmount, uint256 referralAmount, uint256 protocolAmount);

    function factory() external view returns (address);
}
