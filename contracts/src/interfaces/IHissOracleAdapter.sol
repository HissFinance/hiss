// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IHissOracleAdapter
/// @notice Public interface for the HISS oracle read path on Robinhood Chain
///         (4663). Wraps Chainlink feeds with sequencer-uptime, staleness,
///         oracle-paused, and decimals hardening, returning USD prices scaled to
///         18 decimals.
///
/// ERC-8056 CORPORATE-ACTION RULE: Robinhood Chain Stock Token Chainlink feeds
/// ALREADY include the uiMultiplier corporate-action multiplier. Token USD value
/// never applies the multiplier again; share-equivalent is display-only; the
/// underlying per-share price divides the multiplier OUT.
/// @dev Authored from the verified on-chain ABI. Prices are always live reads.
interface IHissOracleAdapter {
    /// @notice Per-token feed configuration.
    struct FeedConfig {
        address feed;
        uint64 stalenessThreshold;
        bool checkOraclePaused;
        bool exists;
    }

    /// @notice Hardened price for `token`, USD scaled to 18 decimals.
    function getPriceUsd18(address token) external view returns (uint256);
    /// @notice USD value (18 decimals) of `rawAmount` of `token`; multiplier NOT applied.
    function tokenValueUsd(address token, uint256 rawAmount) external view returns (uint256);
    /// @notice Display-only share equivalent of `rawAmount` (applies uiMultiplier).
    function shareEquivalent(address token, uint256 rawAmount) external view returns (uint256);
    /// @notice Underlying per-share price with the uiMultiplier divided out.
    function underlyingSharePrice(address token) external view returns (uint256);

    function getFeedConfig(address token) external view returns (FeedConfig memory);
    function setFeed(address token, address feed, uint64 stalenessThreshold, bool checkOraclePaused) external;
    function removeFeed(address token) external;
    function setSequencerUptimeFeed(address feed, uint256 gracePeriod_) external;
    function sequencerUptimeFeed() external view returns (address);
    function gracePeriod() external view returns (uint256);
    function DEFAULT_GRACE_PERIOD() external view returns (uint256);
    function PRICE_DECIMALS() external view returns (uint256);

    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}
