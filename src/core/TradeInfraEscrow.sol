// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {DisputeEscrow} from "./DisputeEscrow.sol";

/// @title Trade Infrastructure Escrow Contract
/// @notice Production-grade escrow for international trade with oracle & arbitration
contract TradeInfraEscrow is DisputeEscrow {
    using SafeERC20 for IERC20;

    // ============ Errors ============
    error OnlyBuyerCanConfirm();
    error OracleVerificationFailed();
    error DocumentsNotCommitted();

    // ============ Constructor ============
    constructor(address _oracleAddress, address _feeRecipient, address _protocolArbiter)
        DisputeEscrow(_oracleAddress, _feeRecipient, _protocolArbiter)
    {}

    // ============ Events ============
    event DeliveryConfirmed(uint256 indexed escrowId, address indexed buyer, uint256 timestamp);
    event OracleConfirmed(uint256 indexed escrowId, bytes32 merkleRoot, uint256 timestamp);
    event CommitmentFulfilled(
        uint256 indexed escrowId, address indexed buyer, uint256 remainingAmount, uint256 timestamp
    );
    event CommitmentDefaulted(
        uint256 indexed escrowId, address indexed seller, uint256 collateralAmount, uint256 timestamp
    );

    /// @notice Buyer manually confirms delivery and releases funds
    function confirmDelivery(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();
        if (msg.sender != txn.buyer) revert OnlyBuyerCanConfirm();

        _releaseFunds(_escrowId, txn.seller);
        emit DeliveryConfirmed(_escrowId, msg.sender, block.timestamp);
    }

    /// @notice Release funds based on oracle verification (requires documents committed)
    function confirmByOracle(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();

        if (escrowDocuments[_escrowId].merkleRoot == bytes32(0)) {
            revert DocumentsNotCommitted();
        }

        if (!oracle.verifyTradeData(escrowDocuments[_escrowId].merkleRoot)) {
            revert OracleVerificationFailed();
        }

        _releaseFunds(_escrowId, txn.seller);
        emit OracleConfirmed(_escrowId, escrowDocuments[_escrowId].merkleRoot, block.timestamp);
    }

    /// @notice Buyer fulfills remaining payment for PAYMENT_COMMITMENT escrow
    function fulfillCommitment(uint256 _escrowId) external payable nonReentrant whenNotPaused {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();
        if (msg.sender != txn.buyer) revert OnlyBuyerCanFund();
        if (txn.mode != EscrowTypes.EscrowMode.PAYMENT_COMMITMENT) {
            revert NotPaymentCommitmentMode();
        }
        if (txn.commitmentFulfilled) revert CommitmentAlreadyFulfilled();
        if (block.timestamp > txn.maturityDate) revert CommitmentOverdue();

        uint256 remaining = txn.amount - txn.collateralAmount;

        if (txn.token == address(0)) {
            if (msg.value != remaining) revert IncorrectETHAmount();
        } else {
            if (msg.value > 0) revert NoETHForERC20Escrow();
            IERC20(txn.token).safeTransferFrom(msg.sender, address(this), remaining);
        }

        txn.commitmentFulfilled = true;
        emit CommitmentFulfilled(_escrowId, msg.sender, remaining, block.timestamp);
    }

    /// @notice Seller claims collateral after buyer defaults on payment commitment
    function claimDefaultedCommitment(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();
        if (msg.sender != txn.seller) revert OnlySellerCanClaimDefault();
        if (txn.mode != EscrowTypes.EscrowMode.PAYMENT_COMMITMENT) {
            revert NotPaymentCommitmentMode();
        }
        if (txn.commitmentFulfilled) revert CommitmentAlreadyFulfilled();
        if (block.timestamp <= txn.maturityDate) {
            revert CommitmentNotYetOverdue();
        }

        uint256 collateral = txn.collateralAmount;
        _releaseFunds(_escrowId, txn.seller);
        emit CommitmentDefaulted(_escrowId, msg.sender, collateral, block.timestamp);
    }

    /// @notice Get maturity status for a payment commitment escrow
    function getMaturityStatus(uint256 _escrowId)
        external
        view
        returns (bool isPC, uint256 maturity, bool fulfilled, bool overdue, uint256 remaining)
    {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction memory txn = escrows[_escrowId];

        isPC = txn.mode == EscrowTypes.EscrowMode.PAYMENT_COMMITMENT;
        maturity = txn.maturityDate;
        fulfilled = txn.commitmentFulfilled;

        if (isPC) {
            overdue = block.timestamp > txn.maturityDate;
            remaining = fulfilled ? 0 : txn.amount - txn.collateralAmount;
        } else {
            overdue = false;
            remaining = 0;
        }
    }

    /// @notice Get user's tier name as string
    function getUserTierName(address _user) external view returns (string memory) {
        EscrowTypes.UserTier tier = getUserTier(_user);
        if (tier == EscrowTypes.UserTier.DIAMOND) return "DIAMOND";
        if (tier == EscrowTypes.UserTier.GOLD) return "GOLD";
        if (tier == EscrowTypes.UserTier.SILVER) return "SILVER";
        return "BRONZE";
    }

    /// @notice Verify an escrow exists
    function escrowIsValid(uint256 _escrowId) external view returns (bool) {
        return escrowExists[_escrowId];
    }
}
