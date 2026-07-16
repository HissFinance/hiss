// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IHissUsdGVault
/// @notice Public interface for a HISS USDG Creator Vault (ERC-4626-style over
///         USDG) on Robinhood Chain (4663). Vaults are compilation/verification
///         software: HISS never takes custody, never places brokerage orders,
///         and never charges AUM/performance-on-execution fees. Deposits ship
///         disabled and are gated by on-chain readiness registries.
/// @dev Authored from the verified on-chain ABI. `acceptingPublicDeposits`,
///      `paused`, balances, and price-per-share are always live chain reads.
interface IHissUsdGVault {
    /// @notice One-time wiring passed at initialize().
    struct Wiring {
        address usdg;
        address factory;
        address assetRegistry;
        address receiptRegistry;
        address legalRegistry;
        address accessPolicy;
        address feeDistributor;
        address oracleAdapter;
    }

    /// @notice Creator-supplied vault parameters passed at initialize().
    struct InitParams {
        string name;
        string symbol;
        address creator;
        address feeRecipient;
        address referral;
        uint16 referralBps;
        uint16 performanceFeeBps;
        uint32 lockupSeconds;
        uint16 minSkinBps;
        bytes32 strategyHash;
        uint32 strategyNoticePeriod;
    }

    /// @notice A single rebalance swap leg (adapter-executed, minBuy-bounded).
    struct RebalanceLeg {
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 minBuyAmount;
    }

    // --- ERC-20 (share token) ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // --- ERC-4626-style flows ---
    event Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed sharesOwner,
        uint256 assets,
        uint256 shares
    );
    event EmergencyExit(address indexed sender, address indexed receiver, uint256 shares);

    // --- Strategy / fees / rebalance / fuses ---
    event StrategyUpdateProposed(bytes32 indexed newStrategyHash, uint64 effectiveAt);
    event StrategyUpdated(bytes32 indexed strategyHash, uint32 version);
    event PerformanceFeeCrystallized(uint256 feeAssetsUsdg, uint256 feeShares, uint256 newHighWaterMarkPps);
    event RebalanceExecuted(bytes32 indexed planHash, uint256 notionalUsdg, uint256 routingFeeUsdg, uint256 legs);
    event ReceiptRecorded(bytes32 indexed receiptHash);
    event FuseViolation(bytes32 indexed code, address indexed token);
    event OperatorSet(address indexed operator);
    event VaultPaused(bool paused);

    function initialize(Wiring calldata wiring, InitParams calldata params) external;

    // --- Deposit / withdraw ---
    function deposit(uint256 assets_, address receiver) external returns (uint256 shares);
    function depositWithAcks(
        uint256 assets_,
        address receiver,
        bytes32 riskAckHash,
        bytes32 jurisdictionAckHash
    ) external returns (uint256 shares);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function withdraw(uint256 assets_, address receiver, address sharesOwner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address sharesOwner) external returns (uint256 assets);
    function emergencyExit(uint256 shares, address receiver) external;

    // --- ERC-4626 previews / accounting ---
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets_) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function previewDeposit(uint256 assets_) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function previewWithdraw(uint256 assets_) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function pricePerShare() external view returns (uint256);
    function highWaterMarkPps() external view returns (uint256);
    function acceptingPublicDeposits() external view returns (bool);

    // --- Held assets / registries ---
    function heldAssets(uint256 index) external view returns (address);
    function heldAssetCount() external view returns (uint256);
    function isHeld(address token) external view returns (bool);
    function assetRegistry() external view returns (address);
    function accessPolicy() external view returns (address);
    function feeDistributor() external view returns (address);
    function legalRegistry() external view returns (address);
    function oracleAdapter() external view returns (address);
    function receiptRegistry() external view returns (address);
    function factory() external view returns (address);
    function usdg() external view returns (address);

    // --- Strategy / operator / fuses ---
    function creator() external view returns (address);
    function operator() external view returns (address);
    function feeRecipient() external view returns (address);
    function referral() external view returns (address);
    function referralBps() external view returns (uint16);
    function performanceFeeBps() external view returns (uint16);
    function minSkinBps() external view returns (uint16);
    function lockupSeconds() external view returns (uint32);
    function strategyHash() external view returns (bytes32);
    function pendingStrategyHash() external view returns (bytes32);
    function strategyVersion() external view returns (uint32);
    function strategyNoticePeriod() external view returns (uint32);
    function strategyEffectiveAt() external view returns (uint64);
    function proposeStrategyUpdate(bytes32 newStrategyHash) external;
    function applyStrategyUpdate() external;
    function crystallizePerformanceFee() external;
    function checkFuses() external returns (bool);
    function enforceFuses() external view;
    function enforceAssetRegistry(address token) external view;
    function enforceLegalReadiness() external view;
    function lastDepositAt(address account) external view returns (uint256);

    // --- Rebalance / receipts (operator-gated, adapter-executed) ---
    function rebalance(RebalanceLeg[] calldata legs, address adapter, bytes32 planHash) external;
    function recordReceipt(bytes32 receiptHash) external;
    function setOperator(address operator_) external;

    // --- Pause ---
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);

    // --- ERC-20 metadata ---
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
