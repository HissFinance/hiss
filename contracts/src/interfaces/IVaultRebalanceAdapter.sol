// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVaultRebalanceAdapter
/// @notice Execution-adapter surface for HissUsdGVault rebalances. Adapters are
///         venue integrations (RFQ / AMM candidates on Robinhood Chain) that a
///         vault calls with a pre-approved sell amount and a hard minBuy bound.
///
/// ADAPTER TRUST MODEL: adapters must be explicitly approved in the
/// VaultAssetRegistry before any vault can route through them. No adapter is
/// approved at deployment — live routing stays OFF until a venue is verified.
interface IVaultRebalanceAdapter {
    /// @notice Executes a single swap leg for the calling vault.
    /// @dev The vault approves exactly `sellAmount` before the call and resets
    ///      the approval to zero afterwards. The adapter must deliver at least
    ///      `minBuyAmount` of `buyToken` to `recipient` or revert.
    /// @param sellToken Token the vault is selling.
    /// @param buyToken Token the vault is buying.
    /// @param sellAmount Exact amount of `sellToken` to pull from the vault.
    /// @param minBuyAmount Minimum acceptable `buyToken` output (slippage bound).
    /// @param recipient Receiver of the bought tokens (always the vault).
    /// @return buyAmount Actual `buyToken` amount delivered.
    function executeSwap(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 minBuyAmount,
        address recipient
    ) external returns (uint256 buyAmount);
}
