// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IXHissVault
/// @notice Public interface for the xHISS single-asset staking vault over $HISS
///         on Robinhood Chain (4663). xHISS is the 18-decimal share token; the
///         rate starts 1:1 and rises only as fee-funded reward injections drip
///         linearly over 24h. Exits require a 72h cooldown then a 2-day redeem
///         window. Timing constants are immutable; exits are NOT pausable.
/// @dev Authored from the verified on-chain ABI. Rate, staked totals, cooldown
///      state, and injector authorization are always live chain reads.
///      Not a performance claim. Historical fee distributions are not forecasts.
interface IXHissVault {
    event Staked(address indexed staker, uint256 hissIn, uint256 sharesOut);
    event Redeemed(address indexed staker, address indexed receiver, uint256 sharesBurned, uint256 hissOut);
    event CooldownStarted(address indexed staker, uint256 sharesAdded, uint256 totalCooling, uint64 readyAt);
    event CooldownRestarted(address indexed staker, uint256 sharesCooling, uint64 readyAt);
    event CooldownCancelled(address indexed staker, uint256 sharesReturned);
    event RewardsInjected(address indexed injector, uint256 hissIn, uint256 carriedUnvested, uint64 dripEndsAt);
    event InjectorSet(address indexed injector, bool approved);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event VaultPaused(bool paused);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Immutable timing / chain constants ---
    function COOLDOWN_SECONDS() external view returns (uint64);
    function REDEEM_WINDOW_SECONDS() external view returns (uint64);
    function DRIP_SECONDS() external view returns (uint64);
    function ROBINHOOD_CHAIN_ID() external view returns (uint256);
    function ROBINHOOD_CHAIN_TESTNET_ID() external view returns (uint256);

    // --- Staking ---
    function stake(uint256 hissAmount) external returns (uint256 sharesOut);
    function previewStake(uint256 hissAmount) external view returns (uint256);
    function convertToShares(uint256 hissAmount) external view returns (uint256);
    function convertToAssets(uint256 xShares) external view returns (uint256);
    function hissPerXHiss() external view returns (uint256);

    // --- Exit (cooldown then redeem window) ---
    function startCooldown(uint256 xShares) external returns (uint64 readyAt);
    function restartCooldown() external returns (uint64 readyAt);
    function cancelCooldown() external;
    function redeem(uint256 xShares, address receiver) external returns (uint256 hissOut);
    function previewRedeem(uint256 xShares) external view returns (uint256);
    function cooldownOf(address staker) external view returns (uint256 sharesCooling, uint64 readyAt, uint64 expiresAt);
    function cooldowns(address staker) external view returns (uint192 shares, uint64 readyAt);

    // --- Reward injection (injector-gated; reverts with zero stakers) ---
    function injectRewards(uint256 hissAmount) external;
    function isInjector(address account) external view returns (bool);
    function setInjector(address injector, bool approved) external;
    function dripAmount() external view returns (uint256);
    function dripStart() external view returns (uint64);
    function dripEnd() external view returns (uint64);
    function unvestedRewards() external view returns (uint256);

    // --- Totals ---
    function hiss() external view returns (address);
    function totalHissStaked() external view returns (uint256);
    function totalXHissSupply() external view returns (uint256);

    // --- Admin ---
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);
    function rescueToken(address token, address to, uint256 amount) external;
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;

    // --- ERC-20 (xHISS share token) ---
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
