// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {DisputeEscrow} from "./DisputeEscrow.sol";

/// @title Trade Infrastructure Escrow Contract
/// @notice Production-grade escrow for international trade with oracle & arbitration
contract TradeInfraEscrow is DisputeEscrow {
    // ============ Errors ============
    error OnlyBuyerCanConfirm();
    error OracleVerificationFailed();

    // ============ Constructor ============
    constructor(address _oracleAddress, address _feeRecipient, address _protocolArbiter)
        DisputeEscrow(_oracleAddress, _feeRecipient, _protocolArbiter)
    {}

    // ============ Events ============
    event DeliveryConfirmed(uint256 indexed escrowId);
    event OracleConfirmed(uint256 indexed escrowId);

    /// @notice Buyer manually confirms delivery and releases funds
    /// @param _escrowId ID of the escrow
    function confirmDelivery(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();
        if (msg.sender != txn.buyer) revert OnlyBuyerCanConfirm();

        _releaseFunds(_escrowId, txn.seller);
        emit DeliveryConfirmed(_escrowId);
    }

    /// @notice Release funds based on oracle verification
    /// @param _escrowId ID of the escrow
    function confirmByOracle(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();

        if (!oracle.verifyTradeData(txn.tradeDataHash)) {
            revert OracleVerificationFailed();
        }

        _releaseFunds(_escrowId, txn.seller);
        emit OracleConfirmed(_escrowId);
    }

    /// @notice Get user's tier name as string
    /// @param _user Address of the user
    /// @return string Tier name (BRONZE, SILVER, GOLD, DIAMOND)
    function getUserTierName(address _user) external view returns (string memory) {
        EscrowTypes.UserTier tier = getUserTier(_user);
        if (tier == EscrowTypes.UserTier.DIAMOND) return "DIAMOND";
        if (tier == EscrowTypes.UserTier.GOLD) return "GOLD";
        if (tier == EscrowTypes.UserTier.SILVER) return "SILVER";
        return "BRONZE";
    }

    /// @notice Verify an escrow exists
    /// @param _escrowId ID to check
    /// @return bool True if escrow exists
    function escrowIsValid(uint256 _escrowId) external view returns (bool) {
        return escrowExists[_escrowId];
    }
}
