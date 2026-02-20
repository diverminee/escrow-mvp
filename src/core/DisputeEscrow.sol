// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {BaseEscrow} from "./BaseEscrow.sol";

/// @title Dispute Escrow Contract
/// @notice Extends base escrow with dispute resolution functionality
contract DisputeEscrow is BaseEscrow {
    // ============ Errors ============
    error NotAParty();
    error NotTheArbiter();
    error NotProtocolArbiter();
    error TooManyDisputes();
    error InvalidRuling();
    error ArbiterDeadlineExpired(); // Primary arbiter acted after deadline
    error DisputeNotExpired(); // Primary arbiter deadline not passed yet
    error EscalationNotExpired(); // Protocol arbiter deadline not passed yet
    error NotEscalated(); // Escrow is not in ESCALATED state

    // ============ Constructor ============
    constructor(
        address _oracleAddress,
        address _feeRecipient,
        address _protocolArbiter
    ) BaseEscrow(_oracleAddress, _feeRecipient, _protocolArbiter) {}

    // ============ Events ============
    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed initiator,
        uint256 deadline
    );
    event DisputeResolved(uint256 indexed escrowId, uint8 indexed ruling);
    event DisputeEscalated(
        uint256 indexed escrowId,
        address indexed escalatedBy,
        uint256 newDeadline
    );
    event EscalationResolved(uint256 indexed escrowId, uint8 indexed ruling);
    event TimeoutClaimed(
        uint256 indexed escrowId,
        address indexed claimedBy,
        address indexed refundedTo
    );

    // ============ Modifiers ============

    /// @notice Verify caller is buyer or seller
    modifier onlyParty(uint256 _escrowId) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction memory txn = escrows[_escrowId];
        if (msg.sender != txn.buyer && msg.sender != txn.seller)
            revert NotAParty();
        _;
    }

    /// @notice Verify caller is the arbiter
    modifier onlyArbiter(uint256 _escrowId) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        if (msg.sender != escrows[_escrowId].arbiter) revert NotTheArbiter();
        _;
    }

    /// @notice Raise a dispute on the escrow transaction
    /// @param _escrowId ID of the escrow
    function raiseDispute(
        uint256 _escrowId
    ) external onlyParty(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();

        address initiator = msg.sender;

        // Check for excessive disputes (prevent abuse)
        // Hard limit: 10+ disputes initiated
        if (disputesInitiated[initiator] >= 10) revert TooManyDisputes();

        // Check loss rate: >50% loss rate with 3+ losses
        // Also blocks users who lost 3+ disputes but never initiated any (defendant losses)
        uint256 losses = disputesLost[initiator];
        if (losses >= 3) {
            uint256 totalDisputes = disputesInitiated[initiator];
            if (totalDisputes == 0 || (losses * 100) / totalDisputes > 50) {
                revert TooManyDisputes();
            }
        }

        // Track dispute initiation
        disputesInitiated[initiator]++;

        // Set primary arbiter deadline (14 days)
        escrows[_escrowId].disputeDeadline = block.timestamp + DISPUTE_TIMELOCK;
        escrows[_escrowId].state = EscrowTypes.State.DISPUTED;
        emit DisputeRaised(
            _escrowId,
            initiator,
            escrows[_escrowId].disputeDeadline
        );
    }

    /// @notice Resolve dispute with arbiter ruling
    /// @param _escrowId ID of the escrow
    /// @param _ruling Ruling (1 = release to seller, 2 = refund to buyer)
    function resolveDispute(
        uint256 _escrowId,
        uint8 _ruling
    ) external onlyArbiter(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DISPUTED) revert InvalidState();
        if (block.timestamp > txn.disputeDeadline)
            revert ArbiterDeadlineExpired();

        if (_ruling == 1) {
            // Ruling in favor of seller
            disputesLost[txn.buyer]++;
            _releaseFunds(_escrowId, txn.seller);
        } else if (_ruling == 2) {
            // Ruling in favor of buyer
            disputesLost[txn.seller]++;
            _refundFunds(_escrowId, txn.buyer);
        } else {
            revert InvalidRuling();
        }

        emit DisputeResolved(_escrowId, _ruling);
    }

    /// @notice Escalate to protocol arbiter after primary arbiter misses 14-day deadline
    /// @dev Callable by either buyer or seller once DISPUTE_TIMELOCK has passed
    /// @param _escrowId ID of the escrow
    function escalateToProtocol(
        uint256 _escrowId
    ) external onlyParty(_escrowId) nonReentrant {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DISPUTED) revert InvalidState();
        if (block.timestamp < txn.disputeDeadline) revert DisputeNotExpired();

        // Upgrade state and give protocol arbiter 7 days to act
        txn.state = EscrowTypes.State.ESCALATED;
        txn.disputeDeadline = block.timestamp + ESCALATION_TIMELOCK;

        emit DisputeEscalated(_escrowId, msg.sender, txn.disputeDeadline);
    }

    /// @notice Protocol arbiter resolves an escalated dispute
    /// @param _escrowId ID of the escrow
    /// @param _ruling Ruling (1 = release to seller, 2 = refund to buyer)
    function resolveEscalation(
        uint256 _escrowId,
        uint8 _ruling
    ) external nonReentrant {
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

        emit EscalationResolved(_escrowId, _ruling);
    }

    /// @notice Final fallback: full refund to buyer if protocol arbiter also goes silent
    /// @dev Callable by anyone after ESCALATION_TIMELOCK expires. Funds never permanently locked.
    /// @param _escrowId ID of the escrow
    function claimTimeout(uint256 _escrowId) external nonReentrant {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.ESCALATED) revert NotEscalated();
        if (block.timestamp < txn.disputeDeadline)
            revert EscalationNotExpired();

        address buyer = txn.buyer;
        // Final safety net: always refund to buyer (Letter of Credit principle:
        // payment follows confirmed delivery; if nobody can confirm, capital returns)
        _refundFunds(_escrowId, buyer);

        emit TimeoutClaimed(_escrowId, msg.sender, buyer);
    }

    /// @notice Check if an address can raise more disputes
    /// @param _user Address to check
    /// @return bool True if user can raise disputes
    function canRaiseDispute(address _user) external view returns (bool) {
        uint256 initiated = disputesInitiated[_user];
        if (initiated >= 10) return false;

        uint256 losses = disputesLost[_user];
        if (losses >= 3) {
            if (initiated == 0 || (losses * 100) / initiated > 50) return false;
        }

        return true;
    }
}
