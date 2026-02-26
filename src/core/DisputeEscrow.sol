// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {BaseEscrow} from "./BaseEscrow.sol";

/// @title Dispute Escrow Contract
/// @notice Extends base escrow with dispute resolution functionality
/// @dev SECURITY FIX: Added split ruling (ruling 3) for partial refunds
abstract contract DisputeEscrow is BaseEscrow {
    // ============ Errors ============
    error NotAParty();
    error NotTheArbiter();
    error NotProtocolArbiter();
    error TooManyDisputes();
    error InvalidRuling();
    error InvalidSplitPercentage();
    error ArbiterDeadlineExpired();
    error DisputeNotExpired();
    error EscalationNotExpired();
    error NotEscalated();

    // ============ SECURITY FIX: Split Ruling ============
    /// @notice Minimum split percentage (10%)
    uint256 public constant MIN_SPLIT_PERCENTAGE = 10;
    /// @notice Maximum split percentage (90%)
    uint256 public constant MAX_SPLIT_PERCENTAGE = 90;

    // ============ Constructor ============
    constructor(address _oracleAddress, address _feeRecipient, address _protocolArbiter)
        BaseEscrow(_oracleAddress, _feeRecipient, _protocolArbiter)
    {}

    // ============ Events ============
    event DisputeRaised(uint256 indexed escrowId, address indexed initiator, uint256 deadline, uint256 timestamp);
    event DisputeResolved(uint256 indexed escrowId, uint8 ruling, address indexed arbiter, uint256 timestamp);
    event DisputeEscalated(
        uint256 indexed escrowId, address indexed escalatedBy, uint256 newDeadline, uint256 timestamp
    );
    event EscalationResolved(uint256 indexed escrowId, uint8 indexed ruling, uint256 timestamp);
    event TimeoutClaimed(
        uint256 indexed escrowId, address indexed claimedBy, address indexed refundedTo, uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyParty(uint256 _escrowId) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction memory txn = escrows[_escrowId];
        if (msg.sender != txn.buyer && msg.sender != txn.seller) {
            revert NotAParty();
        }
        _;
    }

    modifier onlyArbiter(uint256 _escrowId) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        if (msg.sender != escrows[_escrowId].arbiter) revert NotTheArbiter();
        _;
    }

    /// @notice Raise a dispute on a funded escrow
    /// @dev Only buyer or seller can raise. Subject to hard limit (10) and loss-rate checks.
    /// @param _escrowId ID of the escrow to dispute
    function raiseDispute(uint256 _escrowId) external onlyParty(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();

        address initiator = msg.sender;

        if (disputesInitiated[initiator] >= 10) revert TooManyDisputes();

        uint256 losses = disputesLost[initiator];
        if (losses >= 3) {
            uint256 totalDisputes = disputesInitiated[initiator];
            if (totalDisputes == 0 || (losses * 100) / totalDisputes > 50) {
                revert TooManyDisputes();
            }
        }

        disputesInitiated[initiator]++;

        txn.disputeDeadline = block.timestamp + DISPUTE_TIMELOCK;
        txn.state = EscrowTypes.State.DISPUTED;
        emit DisputeRaised(_escrowId, initiator, txn.disputeDeadline, block.timestamp);
    }

    /// @notice Resolve a dispute as the designated arbiter
    /// @param _escrowId ID of the disputed escrow
    /// @param _ruling 1 = release to seller, 2 = refund to buyer
    function resolveDispute(uint256 _escrowId, uint8 _ruling) external onlyArbiter(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DISPUTED) revert InvalidState();
        if (block.timestamp > txn.disputeDeadline) {
            revert ArbiterDeadlineExpired();
        }

        if (_ruling == 1) {
            disputesLost[txn.buyer]++;
            _releaseFunds(_escrowId, txn.seller);
        } else if (_ruling == 2) {
            disputesLost[txn.seller]++;
            _refundFunds(_escrowId, txn.buyer);
        } else {
            revert InvalidRuling();
        }

        emit DisputeResolved(_escrowId, _ruling, msg.sender, block.timestamp);
    }

    /// @notice Escalate a dispute to the protocol arbiter after the arbiter deadline expires
    /// @param _escrowId ID of the disputed escrow
    function escalateToProtocol(uint256 _escrowId) external onlyParty(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DISPUTED) revert InvalidState();
        if (block.timestamp < txn.disputeDeadline) revert DisputeNotExpired();

        txn.state = EscrowTypes.State.ESCALATED;
        txn.disputeDeadline = block.timestamp + ESCALATION_TIMELOCK;

        emit DisputeEscalated(_escrowId, msg.sender, txn.disputeDeadline, block.timestamp);
    }

    /// @notice Resolve an escalated dispute as the protocol arbiter
    /// @param _escrowId ID of the escalated escrow
    /// @param _ruling 1 = release to seller, 2 = refund to buyer
    function resolveEscalation(uint256 _escrowId, uint8 _ruling) external nonReentrant {
        if (msg.sender != protocolArbiter) revert NotProtocolArbiter();
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.ESCALATED) revert NotEscalated();

        if (_ruling == 1) {
            disputesLost[txn.buyer]++;
            _releaseFunds(_escrowId, txn.seller);
        } else if (_ruling == 2) {
            disputesLost[txn.seller]++;
            _refundFunds(_escrowId, txn.buyer);
        } else {
            revert InvalidRuling();
        }

        emit EscalationResolved(_escrowId, _ruling, block.timestamp);
    }

    /// @notice Claim a timeout refund after the escalation deadline expires
    /// @dev Permissionless — anyone can trigger, but funds always go to the buyer
    /// @param _escrowId ID of the escalated escrow
    function claimTimeout(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.ESCALATED) revert NotEscalated();
        if (block.timestamp < txn.disputeDeadline) {
            revert EscalationNotExpired();
        }

        address buyerAddr = txn.buyer;
        _refundFunds(_escrowId, buyerAddr);

        emit TimeoutClaimed(_escrowId, msg.sender, buyerAddr, block.timestamp);
    }

    /// @notice Check whether a user is eligible to raise a new dispute
    /// @param _user Address to check
    /// @return True if the user can raise a dispute
    function canRaiseDispute(address _user) external view returns (bool) {
        uint256 initiated = disputesInitiated[_user];
        if (initiated >= 10) return false;

        uint256 losses = disputesLost[_user];
        if (losses >= 3) {
            if (initiated == 0 || (losses * 100) / initiated > 50) return false;
        }

        return true;
    }

    // ============ SECURITY FIX: Split Ruling Implementation ============

    /// @notice Resolve dispute with split - partial refund to buyer, partial to seller
    /// @param _escrowId ID of the disputed escrow
    /// @param _buyerPercentage Percentage going to buyer (10-90), remainder goes to seller
    function resolveDisputeWithSplit(uint256 _escrowId, uint256 _buyerPercentage) 
        external 
        onlyArbiter(_escrowId) 
        nonReentrant 
    {
        if (_buyerPercentage < MIN_SPLIT_PERCENTAGE || _buyerPercentage > MAX_SPLIT_PERCENTAGE) {
            revert InvalidSplitPercentage();
        }

        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DISPUTED) revert InvalidState();
        if (block.timestamp > txn.disputeDeadline) {
            revert ArbiterDeadlineExpired();
        }

        // Mark dispute as resolved (can't resolve again)
        txn.state = EscrowTypes.State.RELEASED;

        uint256 payoutAmount = txn.commitmentFulfilled ? txn.amount : txn.collateralAmount;
        uint256 feeAmount = (payoutAmount * txn.feeRate) / 1000;
        uint256 totalAmount = payoutAmount - feeAmount;

        // Calculate split
        uint256 buyerAmount = (totalAmount * _buyerPercentage) / 100;
        uint256 sellerAmount = totalAmount - buyerAmount;

        // Update reputation - partial loss for both
        disputesLost[txn.buyer]++;
        disputesLost[txn.seller]++;

        // Transfer funds
        _transferFunds(txn.token, txn.buyer, buyerAmount);
        _transferFunds(txn.token, txn.seller, sellerAmount);
        _transferFunds(txn.token, feeRecipient, feeAmount);

        emit DisputeResolved(_escrowId, 3, msg.sender, block.timestamp); // 3 = split ruling
    }

    /// @notice Resolve escalation with split
    /// @param _escrowId ID of the escalated escrow
    /// @param _buyerPercentage Percentage going to buyer (10-90)
    function resolveEscalationWithSplit(uint256 _escrowId, uint256 _buyerPercentage) 
        external 
        nonReentrant 
    {
        if (msg.sender != protocolArbiter) revert NotProtocolArbiter();
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        
        if (_buyerPercentage < MIN_SPLIT_PERCENTAGE || _buyerPercentage > MAX_SPLIT_PERCENTAGE) {
            revert InvalidSplitPercentage();
        }

        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.ESCALATED) revert NotEscalated();

        // Mark as resolved
        txn.state = EscrowTypes.State.RELEASED;

        uint256 payoutAmount = txn.commitmentFulfilled ? txn.amount : txn.collateralAmount;
        uint256 feeAmount = (payoutAmount * txn.feeRate) / 1000;
        uint256 totalAmount = payoutAmount - feeAmount;

        // Calculate split
        uint256 buyerAmount = (totalAmount * _buyerPercentage) / 100;
        uint256 sellerAmount = totalAmount - buyerAmount;

        // Update reputation
        disputesLost[txn.buyer]++;
        disputesLost[txn.seller]++;

        // Transfer funds
        _transferFunds(txn.token, txn.buyer, buyerAmount);
        _transferFunds(txn.token, txn.seller, sellerAmount);
        _transferFunds(txn.token, feeRecipient, feeAmount);

        emit EscalationResolved(_escrowId, 3, block.timestamp);
    }
}
