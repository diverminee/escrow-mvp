// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITradeOracle} from "../interfaces/ITradeOracle.sol";
import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {ReputationLibrary} from "../libraries/ReputationLibrary.sol";

/// @title Base Escrow Contract
/// @notice Core escrow logic with reputation system
/// @dev Abstract contract providing foundational escrow functionality
abstract contract BaseEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    ITradeOracle public immutable oracle;
    address public immutable feeRecipient;
    address public immutable protocolArbiter; // Escalation fallback (protocol multisig)
    address public owner; // Admin for KYC and token registry

    mapping(uint256 => EscrowTypes.EscrowTransaction) public escrows;
    uint256 public nextEscrowId;

    // Reputation tracking
    mapping(address => uint256) public successfulTrades;
    mapping(address => uint256) public disputesInitiated;
    mapping(address => uint256) public disputesLost;

    // Track which escrows were created (prevents phantom escrow attacks)
    mapping(uint256 => bool) internal escrowExists;

    // KYC: addresses approved to create/participate in escrows
    mapping(address => bool) public kycApproved;

    // Soft token allowlist: recommended/approved tokens (does not block other tokens)
    mapping(address => bool) public approvedTokens;

    // Constants for validation
    uint256 public constant MAX_ESCROW_AMOUNT = 10_000_000e18; // 10M tokens max
    uint256 public constant MIN_ESCROW_AMOUNT = 1000; // Minimum to prevent dust/zero-fee escrows

    // Two-tier escalation timelocks
    uint256 public constant DISPUTE_TIMELOCK = 14 days; // Primary arbiter window
    uint256 public constant ESCALATION_TIMELOCK = 7 days; // Protocol arbiter window

    // ============ Errors ============
    error InvalidAddresses();
    error InvalidAmount();
    error DivisionByZero();
    error EscrowNotFound();
    error AmountExceedsMaximum();
    error InvalidState();
    error OnlyBuyerCanFund();
    error IncorrectETHAmount();
    error NoETHForERC20Escrow();
    error ETHTransferFailed();
    error SellerCannotBeBuyer();
    error ArbiterCannotBeBuyer();
    error ArbiterCannotBeSeller();
    error ProtocolArbiterCannotBeParty();
    error ArbiterCannotBeProtocolArbiter();
    error AmountBelowMinimum();
    error NotKYCApproved();
    error NotOwner();

    // ============ Events ============
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount
    );
    event Funded(uint256 indexed escrowId, uint256 amount);
    event Released(
        uint256 indexed escrowId,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );
    event Refunded(
        uint256 indexed escrowId,
        address indexed recipient,
        uint256 amount
    );
    event KYCStatusUpdated(address indexed user, bool approved);
    event ApprovedTokenAdded(address indexed token);
    event ApprovedTokenRemoved(address indexed token);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============ Constructor ============
    /// @notice Initialize contract with oracle and fee recipient
    /// @param _oracleAddress Address of the trade oracle
    /// @param _feeRecipient Address to receive transaction fees
    constructor(
        address _oracleAddress,
        address _feeRecipient,
        address _protocolArbiter
    ) {
        if (
            _oracleAddress == address(0) ||
            _feeRecipient == address(0) ||
            _protocolArbiter == address(0)
        ) revert InvalidAddresses();
        if (_protocolArbiter == _feeRecipient) revert InvalidAddresses();
        oracle = ITradeOracle(_oracleAddress);
        feeRecipient = _feeRecipient;
        protocolArbiter = _protocolArbiter;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Admin Functions ============

    /// @notice Approve or revoke KYC status for a user
    /// @param user Address to update
    /// @param approved True to approve, false to revoke
    function setKYCStatus(address user, bool approved) external onlyOwner {
        kycApproved[user] = approved;
        emit KYCStatusUpdated(user, approved);
    }

    /// @notice Batch approve or revoke KYC status for multiple users
    /// @param users Array of addresses to update
    /// @param approved True to approve, false to revoke
    function batchSetKYCStatus(address[] calldata users, bool approved) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            kycApproved[users[i]] = approved;
            emit KYCStatusUpdated(users[i], approved);
        }
    }

    /// @notice Add a token to the recommended/approved token list
    /// @param token Address of the ERC20 token (address(0) for ETH)
    function addApprovedToken(address token) external onlyOwner {
        approvedTokens[token] = true;
        emit ApprovedTokenAdded(token);
    }

    /// @notice Remove a token from the recommended/approved token list
    /// @param token Address of the ERC20 token
    function removeApprovedToken(address token) external onlyOwner {
        approvedTokens[token] = false;
        emit ApprovedTokenRemoved(token);
    }

    /// @notice Transfer contract ownership
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddresses();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ============ Core Functions ============

    /// @notice Create a new escrow transaction
    /// @param _seller Address of the seller
    /// @param _arbiter Address of the dispute arbiter
    /// @param _token Address of ERC20 token (address(0) for ETH)
    /// @param _amount Amount to escrow
    /// @param _tradeId External trade ID
    /// @param _tradeDataHash Hash of trade data for oracle verification
    /// @return escrowId The ID of created escrow
    function createEscrow(
        address _seller,
        address _arbiter,
        address _token,
        uint256 _amount,
        uint256 _tradeId,
        bytes32 _tradeDataHash
    ) external returns (uint256) {
        if (_seller == address(0) || _arbiter == address(0)) {
            revert InvalidAddresses();
        }
        if (!kycApproved[msg.sender]) revert NotKYCApproved();
        if (!kycApproved[_seller]) revert NotKYCApproved();
        if (_amount == 0) revert InvalidAmount();
        if (_amount < MIN_ESCROW_AMOUNT) revert AmountBelowMinimum();
        if (_amount > MAX_ESCROW_AMOUNT) revert AmountExceedsMaximum();
        if (msg.sender == _seller) revert SellerCannotBeBuyer();
        if (_arbiter == msg.sender) revert ArbiterCannotBeBuyer();
        if (_arbiter == _seller) revert ArbiterCannotBeSeller();
        if (msg.sender == protocolArbiter || _seller == protocolArbiter)
            revert ProtocolArbiterCannotBeParty();
        if (_arbiter == protocolArbiter)
            revert ArbiterCannotBeProtocolArbiter();

        // Snapshot seller's fee rate at creation time
        EscrowTypes.UserTier sellerTier = ReputationLibrary.getUserTier(
            successfulTrades[_seller],
            disputesLost[_seller]
        );
        uint256 feeRate = ReputationLibrary.getFeeRate(sellerTier);

        // Increment ID only after all validation passes
        uint256 escrowId = nextEscrowId++;

        escrows[escrowId] = EscrowTypes.EscrowTransaction({
            buyer: msg.sender,
            seller: _seller,
            arbiter: _arbiter,
            token: _token,
            amount: _amount,
            tradeId: _tradeId,
            tradeDataHash: _tradeDataHash,
            state: EscrowTypes.State.DRAFT,
            disputeDeadline: 0,
            feeRate: feeRate
        });

        escrowExists[escrowId] = true;
        emit EscrowCreated(escrowId, msg.sender, _seller, _amount);
        return escrowId;
    }

    /// @notice Fund the escrow with ETH or ERC20 tokens
    /// @param _escrowId ID of the escrow to fund
    function fund(uint256 _escrowId) external payable nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DRAFT) revert InvalidState();
        if (msg.sender != txn.buyer) revert OnlyBuyerCanFund();

        if (txn.token == address(0)) {
            if (msg.value != txn.amount) revert IncorrectETHAmount();
        } else {
            if (msg.value > 0) revert NoETHForERC20Escrow();
            IERC20(txn.token).safeTransferFrom(
                msg.sender,
                address(this),
                txn.amount
            );
        }

        txn.state = EscrowTypes.State.FUNDED;
        emit Funded(_escrowId, txn.amount);
    }

    // ============ Internal Functions ============

    /// @notice Internal function to release funds with fee deduction (seller wins)
    /// @param _escrowId ID of the escrow
    /// @param _recipient Address to receive funds (seller)
    function _releaseFunds(uint256 _escrowId, address _recipient) internal {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        // Accept FUNDED, DISPUTED, or ESCALATED (protocol arbiter resolution)
        if (
            txn.state != EscrowTypes.State.FUNDED &&
            txn.state != EscrowTypes.State.DISPUTED &&
            txn.state != EscrowTypes.State.ESCALATED
        ) {
            revert InvalidState();
        }

        txn.state = EscrowTypes.State.RELEASED;

        // Use fee rate snapshotted at escrow creation
        uint256 feeAmount = (txn.amount * txn.feeRate) / 1000;
        uint256 recipientAmount = txn.amount - feeAmount;

        // Track successful trade for both parties (symmetric)
        successfulTrades[_recipient]++;
        successfulTrades[txn.buyer]++;

        // Transfer funds
        _transferFunds(txn.token, _recipient, recipientAmount);
        _transferFunds(txn.token, feeRecipient, feeAmount);

        emit Released(_escrowId, _recipient, recipientAmount, feeAmount);
    }

    /// @notice Internal function to refund funds to buyer (buyer wins)
    /// @param _escrowId ID of the escrow
    /// @param _recipient Address to receive refund (buyer)
    function _refundFunds(uint256 _escrowId, address _recipient) internal {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        // Accept FUNDED, DISPUTED, or ESCALATED (timeout refund)
        if (
            txn.state != EscrowTypes.State.FUNDED &&
            txn.state != EscrowTypes.State.DISPUTED &&
            txn.state != EscrowTypes.State.ESCALATED
        ) {
            revert InvalidState();
        }

        txn.state = EscrowTypes.State.REFUNDED;

        // No successfulTrades credit: a refund means the trade did not complete

        // Transfer full refund (no fee deduction)
        _transferFunds(txn.token, _recipient, txn.amount);

        emit Refunded(_escrowId, _recipient, txn.amount);
    }

    /// @notice Internal function to safely transfer funds
    /// @param token Address of token (address(0) for ETH)
    /// @param recipient Address to receive funds
    /// @param amount Amount to transfer
    function _transferFunds(
        address token,
        address recipient,
        uint256 amount
    ) internal {
        if (token == address(0)) {
            (bool sent, ) = payable(recipient).call{value: amount}("");
            if (!sent) revert ETHTransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    // ============ View Functions ============

    /// @notice Get full escrow transaction details
    /// @param _escrowId ID of the escrow
    /// @return EscrowTransaction struct with all details
    function getEscrow(
        uint256 _escrowId
    ) external view returns (EscrowTypes.EscrowTransaction memory) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        return escrows[_escrowId];
    }

    /// @notice Get current number of escrows
    /// @return uint256 Total escrow count
    function getEscrowCount() external view returns (uint256) {
        return nextEscrowId;
    }

    /// @notice Get user's current tier
    /// @param _user Address of the user
    /// @return EscrowTypes.UserTier Current tier
    function getUserTier(
        address _user
    ) public view returns (EscrowTypes.UserTier) {
        return
            ReputationLibrary.getUserTier(
                successfulTrades[_user],
                disputesLost[_user]
            );
    }

    /// @notice Get user's current fee rate
    /// @param _user Address of the user
    /// @return uint256 Fee in basis points (e.g., 12 = 1.2%)
    function getUserFeeRate(address _user) external view returns (uint256) {
        EscrowTypes.UserTier tier = ReputationLibrary.getUserTier(
            successfulTrades[_user],
            disputesLost[_user]
        );
        return ReputationLibrary.getFeeRate(tier);
    }

    /// @notice Get user's reputation statistics
    /// @param _user Address of the user
    /// @return trades Number of successful trades
    /// @return initiated Number of disputes initiated
    /// @return lost Number of disputes lost
    function getUserStats(
        address _user
    ) external view returns (uint256 trades, uint256 initiated, uint256 lost) {
        return (
            successfulTrades[_user],
            disputesInitiated[_user],
            disputesLost[_user]
        );
    }
}
