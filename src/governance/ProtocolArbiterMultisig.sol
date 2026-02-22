// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/// @title ProtocolArbiterMultisig
/// @notice Minimal multisig that acts as the protocolArbiter for TradeInfraEscrow
/// @dev Requires threshold-of-N signers to resolve escalated disputes
contract ProtocolArbiterMultisig {
    // ============ Errors ============
    error NotSigner();
    error InvalidThreshold();
    error AlreadyApproved();
    error NotApproved();
    error ProposalExpired();
    error ProposalNotFound();
    error AlreadySigner();
    error NotAlreadySigner();
    error InvalidAddress();
    error ThresholdExceedsSigners();

    // ============ Events ============
    event ResolutionProposed(
        uint256 indexed proposalId, uint256 indexed escrowId, uint8 ruling, address indexed proposer
    );
    event ResolutionApproved(uint256 indexed proposalId, address indexed approver);
    event ResolutionRevoked(uint256 indexed proposalId, address indexed revoker);
    event ResolutionExecuted(uint256 indexed proposalId, uint256 indexed escrowId, uint8 ruling);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event GovernanceActionProposed(uint256 indexed proposalId, address indexed target, address indexed proposer);
    event GovernanceActionExecuted(uint256 indexed proposalId, address indexed target);

    // ============ Constants ============
    uint256 public constant PROPOSAL_EXPIRY = 7 days;

    // ============ State Variables ============
    address public immutable escrow;
    uint256 public threshold;

    mapping(address => bool) public isSigner;
    address[] public signers;

    struct Proposal {
        uint256 escrowId;
        uint8 ruling;
        uint256 createdAt;
        bool executed;
        uint256 approvalCount;
        address target;
        bytes callData;
        mapping(address => bool) approvals;
    }

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;

    // ============ Constructor ============
    /// @notice Deploy the multisig arbiter
    /// @param _escrow Address of the TradeInfraEscrow contract
    /// @param _signers Initial signer addresses
    /// @param _threshold Minimum approvals required
    constructor(address _escrow, address[] memory _signers, uint256 _threshold) {
        if (_escrow == address(0)) revert InvalidAddress();
        if (_signers.length == 0) revert InvalidThreshold();
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();

        escrow = _escrow;
        threshold = _threshold;

        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == address(0)) revert InvalidAddress();
            if (isSigner[_signers[i]]) revert AlreadySigner();
            isSigner[_signers[i]] = true;
            signers.push(_signers[i]);
        }
    }

    // ============ Modifiers ============
    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    // ============ External Functions ============

    /// @notice Propose a resolution for an escalated dispute
    /// @param escrowId The escrow ID to resolve
    /// @param ruling The ruling (1 = seller, 2 = buyer)
    /// @return proposalId The created proposal ID
    function proposeResolution(uint256 escrowId, uint8 ruling) external onlySigner returns (uint256 proposalId) {
        proposalId = nextProposalId++;
        Proposal storage p = proposals[proposalId];
        p.escrowId = escrowId;
        p.ruling = ruling;
        p.createdAt = block.timestamp;

        // Proposer automatically approves
        p.approvals[msg.sender] = true;
        p.approvalCount = 1;

        emit ResolutionProposed(proposalId, escrowId, ruling, msg.sender);
        emit ResolutionApproved(proposalId, msg.sender);

        // Check if threshold already met (e.g., threshold = 1)
        if (p.approvalCount >= threshold) {
            _executeProposal(proposalId);
        }
    }

    /// @notice Approve a pending resolution proposal
    /// @param proposalId The proposal to approve
    function approveResolution(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        if (p.createdAt == 0) revert ProposalNotFound();
        if (p.executed) revert ProposalNotFound();
        if (block.timestamp > p.createdAt + PROPOSAL_EXPIRY) revert ProposalExpired();
        if (p.approvals[msg.sender]) revert AlreadyApproved();

        p.approvals[msg.sender] = true;
        p.approvalCount++;

        emit ResolutionApproved(proposalId, msg.sender);

        if (p.approvalCount >= threshold) {
            _executeProposal(proposalId);
        }
    }

    /// @notice Revoke approval before threshold is reached
    /// @param proposalId The proposal to revoke from
    function revokeApproval(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        if (p.createdAt == 0) revert ProposalNotFound();
        if (p.executed) revert ProposalNotFound();
        if (!p.approvals[msg.sender]) revert NotApproved();

        p.approvals[msg.sender] = false;
        p.approvalCount--;

        emit ResolutionRevoked(proposalId, msg.sender);
    }

    /// @notice Propose a generic governance action (e.g., addSigner, removeSigner)
    /// @param _target Address to call (typically address(this) for signer management)
    /// @param _callData ABI-encoded function call
    /// @return proposalId The created proposal ID
    function proposeGovernanceAction(address _target, bytes calldata _callData)
        external
        onlySigner
        returns (uint256 proposalId)
    {
        if (_target == address(0)) revert InvalidAddress();

        proposalId = nextProposalId++;
        Proposal storage p = proposals[proposalId];
        p.target = _target;
        p.callData = _callData;
        p.createdAt = block.timestamp;

        // Proposer automatically approves
        p.approvals[msg.sender] = true;
        p.approvalCount = 1;

        emit GovernanceActionProposed(proposalId, _target, msg.sender);
        emit ResolutionApproved(proposalId, msg.sender);

        if (p.approvalCount >= threshold) {
            _executeProposal(proposalId);
        }
    }

    /// @notice Add a new signer (requires calling from this contract itself via proposal execution)
    /// @param signer Address to add
    function addSigner(address signer) external {
        if (msg.sender != address(this)) revert NotSigner();
        if (signer == address(0)) revert InvalidAddress();
        if (isSigner[signer]) revert AlreadySigner();

        isSigner[signer] = true;
        signers.push(signer);
        emit SignerAdded(signer);
    }

    /// @notice Remove a signer (requires calling from this contract itself via proposal execution)
    /// @param signer Address to remove
    function removeSigner(address signer) external {
        if (msg.sender != address(this)) revert NotSigner();
        if (!isSigner[signer]) revert NotAlreadySigner();
        if (signers.length - 1 < threshold) revert ThresholdExceedsSigners();

        isSigner[signer] = false;

        // Remove from array
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        emit SignerRemoved(signer);
    }

    // ============ View Functions ============

    /// @notice Get the number of signers
    /// @return uint256 Number of signers
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /// @notice Check if a signer has approved a proposal
    /// @param proposalId The proposal ID
    /// @param signer The signer address
    /// @return bool True if approved
    function hasApproved(uint256 proposalId, address signer) external view returns (bool) {
        return proposals[proposalId].approvals[signer];
    }

    // ============ Internal Functions ============

    /// @notice Execute a proposal — either resolveEscalation or a governance action
    function _executeProposal(uint256 proposalId) internal {
        Proposal storage p = proposals[proposalId];
        p.executed = true;

        if (p.callData.length > 0) {
            // Governance action (e.g., addSigner, removeSigner)
            (bool success,) = p.target.call(p.callData);
            require(success, "governance action failed");
            emit GovernanceActionExecuted(proposalId, p.target);
        } else {
            // Legacy resolution path
            (bool success,) =
                escrow.call(abi.encodeWithSignature("resolveEscalation(uint256,uint8)", p.escrowId, p.ruling));
            require(success, "resolveEscalation failed");
            emit ResolutionExecuted(proposalId, p.escrowId, p.ruling);
        }
    }
}
