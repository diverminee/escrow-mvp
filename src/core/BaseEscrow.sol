// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ITradeOracle} from "../interfaces/ITradeOracle.sol";
import {IReceivableMinter} from "../interfaces/IReceivableMinter.sol";
import {EscrowTypes} from "../libraries/EscrowTypes.sol";
import {ReputationLibrary} from "../libraries/ReputationLibrary.sol";

/// @title Base Escrow Contract
/// @notice Core escrow logic with reputation system, KYC, tiers, documents, receivables
/// @dev Abstract contract providing foundational escrow functionality
abstract contract BaseEscrow is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    ITradeOracle public immutable oracle;
    address public feeRecipient;
    address public protocolArbiter;

    address public owner;

    mapping(uint256 => EscrowTypes.EscrowTransaction) public escrows;
    uint256 public nextEscrowId;

    // Reputation tracking
    mapping(address => uint256) public successfulTrades;
    mapping(address => uint256) public disputesInitiated;
    mapping(address => uint256) public disputesLost;

    // Track which escrows were created
    mapping(uint256 => bool) internal escrowExists;

    // KYC
    mapping(address => bool) public kycApproved;

    // Token allowlist
    mapping(address => bool) public approvedTokens;

    // Deployment tier
    EscrowTypes.DeploymentTier public currentTier;
    uint256 public maxEscrowAmount;

    // Documents
    mapping(uint256 => EscrowTypes.DocumentSet) public escrowDocuments;

    // Receivable NFT
    address public receivableMinter;
    mapping(uint256 => uint256) internal escrowToReceivableTokenId;

    // ============ Constants ============
    uint256 public constant DISPUTE_TIMELOCK = 14 days;
    uint256 public constant ESCALATION_TIMELOCK = 7 days;

    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant DEFAULT_COLLATERAL_BPS = 2000;
    uint256 public constant DEFAULT_MATURITY_DAYS = 60;
    uint256 public constant MIN_COLLATERAL_BPS = 1000;
    uint256 public constant MAX_COLLATERAL_BPS = 5000;

    // ============ Configurable Limits ============
    uint256 public minEscrowAmount = 0.01 ether;
    uint256 public launchLimit = 50_000e18;
    uint256 public growthLimit = 500_000e18;
    uint256 public matureLimit = 10_000_000e18;

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
    error NotOwner();
    error NotKYCApproved();
    error TierCanOnlyIncrease();
    error AmountExceedsTierCeiling();
    error OnlySellerCanCommitDocuments();
    error DocumentsAlreadyCommitted();
    error NoDocumentHashes();
    error InvalidCollateralBps();
    error NotPaymentCommitmentMode();
    error CommitmentAlreadyFulfilled();
    error CommitmentOverdue();
    error CommitmentNotYetOverdue();
    error OnlySellerCanClaimDefault();
    error InvalidTierLimits();
    error FeeRecipientCannotBeArbiter();
    error ZeroAddress();

    // ============ Events ============
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        address token,
        uint8 mode,
        uint256 faceValue
    );
    event EscrowFunded(uint256 indexed escrowId, address indexed buyer, uint256 amount, uint256 timestamp);
    event EscrowSettled(uint256 indexed escrowId, address indexed recipient, uint256 amount, uint256 fee);
    event EscrowRefunded(uint256 indexed escrowId, address indexed recipient, uint256 amount);
    event KYCStatusUpdated(address indexed user, bool status);
    event ApprovedTokenAdded(address indexed token);
    event ApprovedTokenRemoved(address indexed token);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event DeploymentTierUpgraded(uint8 indexed oldTier, uint8 indexed newTier, uint256 maxAmount);
    event DocumentsCommitted(uint256 indexed escrowId, bytes32 merkleRoot, uint256 timestamp);
    event ReceivableMinted(uint256 indexed escrowId, uint256 tokenId);
    event ReceivableMintFailed(uint256 indexed escrowId, bytes reason);
    event ReceivableMinterUpdated(address indexed oldMinter, address indexed newMinter);
    event MinEscrowAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event TierLimitsUpdated(uint256 launch, uint256 growth, uint256 mature);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ProtocolArbiterUpdated(address indexed oldArbiter, address indexed newArbiter);

    // ============ Constructor ============
    constructor(address _oracleAddress, address _feeRecipient, address _protocolArbiter) {
        if (_oracleAddress == address(0) || _feeRecipient == address(0) || _protocolArbiter == address(0)) {
            revert InvalidAddresses();
        }
        if (_protocolArbiter == _feeRecipient) revert InvalidAddresses();
        oracle = ITradeOracle(_oracleAddress);
        feeRecipient = _feeRecipient;
        protocolArbiter = _protocolArbiter;
        owner = msg.sender;
        maxEscrowAmount = type(uint256).max; // TESTNET default
    }

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============ Core Functions ============

    /// @notice Create a new escrow (CASH_LOCK mode, 6-param)
    function createEscrow(
        address _seller,
        address _arbiter,
        address _token,
        uint256 _amount,
        uint256 _tradeId,
        bytes32 _tradeDataHash
    ) external whenNotPaused returns (uint256) {
        return _createEscrowInternal(
            _seller, _arbiter, _token, _amount, _tradeId, _tradeDataHash, EscrowTypes.EscrowMode.CASH_LOCK, 0, 0
        );
    }

    /// @notice Create a new escrow with explicit mode (9-param)
    function createEscrow(
        address _seller,
        address _arbiter,
        address _token,
        uint256 _amount,
        uint256 _tradeId,
        bytes32 _tradeDataHash,
        EscrowTypes.EscrowMode _mode,
        uint256 _maturityDays,
        uint256 _collateralBps
    ) external whenNotPaused returns (uint256) {
        return _createEscrowInternal(
            _seller, _arbiter, _token, _amount, _tradeId, _tradeDataHash, _mode, _maturityDays, _collateralBps
        );
    }

    /// @notice Fund the escrow with ETH or ERC20 tokens
    function fund(uint256 _escrowId) external payable nonReentrant whenNotPaused {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.DRAFT) revert InvalidState();
        if (msg.sender != txn.buyer) revert OnlyBuyerCanFund();

        if (txn.token == address(0)) {
            if (msg.value != txn.collateralAmount) revert IncorrectETHAmount();
        } else {
            if (msg.value > 0) revert NoETHForERC20Escrow();
            IERC20(txn.token).safeTransferFrom(msg.sender, address(this), txn.collateralAmount);
        }

        txn.state = EscrowTypes.State.FUNDED;
        emit EscrowFunded(_escrowId, msg.sender, txn.collateralAmount, block.timestamp);
    }

    /// @notice Commit trade documents with Merkle root
    function commitDocuments(
        uint256 _escrowId,
        bytes32 _invoiceHash,
        bytes32 _bolHash,
        bytes32 _packingHash,
        bytes32 _cooHash
    ) external {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (txn.state != EscrowTypes.State.FUNDED) revert InvalidState();
        if (msg.sender != txn.seller) revert OnlySellerCanCommitDocuments();

        EscrowTypes.DocumentSet storage docs = escrowDocuments[_escrowId];
        if (docs.committedAt != 0) revert DocumentsAlreadyCommitted();
        if (
            _invoiceHash == bytes32(0) && _bolHash == bytes32(0) && _packingHash == bytes32(0) && _cooHash == bytes32(0)
        ) revert NoDocumentHashes();

        bytes32 merkleRoot = _computeMerkleRoot(_invoiceHash, _bolHash, _packingHash, _cooHash);

        docs.invoiceHash = _invoiceHash;
        docs.bolHash = _bolHash;
        docs.packingHash = _packingHash;
        docs.cooHash = _cooHash;
        docs.merkleRoot = merkleRoot;
        docs.committedAt = block.timestamp;

        emit DocumentsCommitted(_escrowId, merkleRoot, block.timestamp);

        // Mint receivable NFT for PAYMENT_COMMITMENT escrows
        if (txn.mode == EscrowTypes.EscrowMode.PAYMENT_COMMITMENT && receivableMinter != address(0)) {
            try IReceivableMinter(receivableMinter).mintReceivable(
                _escrowId, txn.seller, txn.faceValue, txn.maturityDate, merkleRoot, txn.token
            ) returns (uint256 tokenId) {
                escrowToReceivableTokenId[_escrowId] = tokenId;
                emit ReceivableMinted(_escrowId, tokenId);
            } catch (bytes memory reason) {
                emit ReceivableMintFailed(_escrowId, reason);
            }
        }
    }

    // ============ Admin Functions ============

    /// @notice Set KYC approval status for a single user
    /// @param _user Address to update
    /// @param _status True to approve, false to revoke
    function setKYCStatus(address _user, bool _status) external onlyOwner {
        kycApproved[_user] = _status;
        emit KYCStatusUpdated(_user, _status);
    }

    /// @notice Set KYC approval status for multiple users in a single call
    /// @param _users Array of addresses to update
    /// @param _status True to approve, false to revoke
    function batchSetKYCStatus(address[] calldata _users, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            kycApproved[_users[i]] = _status;
            emit KYCStatusUpdated(_users[i], _status);
        }
    }

    /// @notice Add a token to the approved allowlist
    /// @param _token ERC-20 token address to approve
    function addApprovedToken(address _token) external onlyOwner {
        approvedTokens[_token] = true;
        emit ApprovedTokenAdded(_token);
    }

    /// @notice Remove a token from the approved allowlist
    /// @param _token ERC-20 token address to remove
    function removeApprovedToken(address _token) external onlyOwner {
        approvedTokens[_token] = false;
        emit ApprovedTokenRemoved(_token);
    }

    /// @notice Transfer contract ownership to a new address
    /// @param _newOwner Address of the new owner (cannot be zero)
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddresses();
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    /// @notice Upgrade the deployment tier (one-way, cannot decrease)
    /// @param _newTier New tier to upgrade to (must be higher than current)
    function upgradeTier(EscrowTypes.DeploymentTier _newTier) external onlyOwner {
        if (uint8(_newTier) <= uint8(currentTier)) revert TierCanOnlyIncrease();
        uint8 oldTier = uint8(currentTier);
        currentTier = _newTier;
        maxEscrowAmount = _getTierCeiling(_newTier);
        emit DeploymentTierUpgraded(oldTier, uint8(_newTier), maxEscrowAmount);
    }

    /// @notice Set a custom max escrow amount within the current tier ceiling
    /// @param _amount New maximum (must not exceed tier ceiling)
    function setMaxEscrowAmount(uint256 _amount) external onlyOwner {
        if (_amount > _getTierCeiling(currentTier)) {
            revert AmountExceedsTierCeiling();
        }
        maxEscrowAmount = _amount;
    }

    /// @notice Set the receivable NFT minter contract address
    /// @param _minter Address of the IReceivableMinter (or zero to disable)
    function setReceivableMinter(address _minter) external onlyOwner {
        address oldMinter = receivableMinter;
        receivableMinter = _minter;
        emit ReceivableMinterUpdated(oldMinter, _minter);
    }

    /// @notice Set the minimum escrow amount (token-agnostic)
    /// @param _min New minimum amount
    function setMinEscrowAmount(uint256 _min) external onlyOwner {
        uint256 oldAmount = minEscrowAmount;
        minEscrowAmount = _min;
        emit MinEscrowAmountUpdated(oldAmount, _min);
    }

    /// @notice Set tier ceiling limits (must maintain launch <= growth <= mature)
    /// @param _launch Launch tier ceiling
    /// @param _growth Growth tier ceiling
    /// @param _mature Mature tier ceiling
    function setTierLimits(uint256 _launch, uint256 _growth, uint256 _mature) external onlyOwner {
        if (_launch > _growth || _growth > _mature) revert InvalidTierLimits();
        launchLimit = _launch;
        growthLimit = _growth;
        matureLimit = _mature;
        emit TierLimitsUpdated(_launch, _growth, _mature);
    }

    /// @notice Update the fee recipient address
    /// @param _feeRecipient New fee recipient (cannot be zero or same as protocolArbiter)
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_feeRecipient == protocolArbiter) revert FeeRecipientCannotBeArbiter();
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    /// @notice Update the protocol arbiter address
    /// @param _protocolArbiter New protocol arbiter (cannot be zero or same as feeRecipient)
    function setProtocolArbiter(address _protocolArbiter) external onlyOwner {
        if (_protocolArbiter == address(0)) revert ZeroAddress();
        if (_protocolArbiter == feeRecipient) revert FeeRecipientCannotBeArbiter();
        emit ProtocolArbiterUpdated(protocolArbiter, _protocolArbiter);
        protocolArbiter = _protocolArbiter;
    }

    /// @notice Pause the contract — blocks createEscrow, fund, and fulfillCommitment
    /// @dev Only callable by the contract owner. Existing escrows can still settle and dispute.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract — restores normal operation
    /// @dev Only callable by the contract owner.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    function _createEscrowInternal(
        address _seller,
        address _arbiter,
        address _token,
        uint256 _amount,
        uint256 _tradeId,
        bytes32 _tradeDataHash,
        EscrowTypes.EscrowMode _mode,
        uint256 _maturityDays,
        uint256 _collateralBps
    ) internal returns (uint256) {
        if (_seller == address(0) || _arbiter == address(0)) {
            revert InvalidAddresses();
        }
        if (_amount == 0) revert InvalidAmount();
        if (_amount < minEscrowAmount) revert AmountBelowMinimum();
        if (_amount > maxEscrowAmount) revert AmountExceedsMaximum();
        if (msg.sender == _seller) revert SellerCannotBeBuyer();
        if (_arbiter == msg.sender) revert ArbiterCannotBeBuyer();
        if (_arbiter == _seller) revert ArbiterCannotBeSeller();
        if (msg.sender == protocolArbiter || _seller == protocolArbiter) {
            revert ProtocolArbiterCannotBeParty();
        }
        if (_arbiter == protocolArbiter) {
            revert ArbiterCannotBeProtocolArbiter();
        }
        if (!kycApproved[msg.sender]) revert NotKYCApproved();
        if (!kycApproved[_seller]) revert NotKYCApproved();

        // Snapshot seller's fee rate at creation time
        EscrowTypes.UserTier sellerTier =
            ReputationLibrary.getUserTier(successfulTrades[_seller], disputesLost[_seller]);
        uint256 feeRate = ReputationLibrary.getFeeRate(sellerTier);

        // Calculate payment commitment fields
        uint256 collateralAmount;
        uint256 collateralBps;
        uint256 maturityDate;

        if (_mode == EscrowTypes.EscrowMode.PAYMENT_COMMITMENT) {
            collateralBps = _collateralBps == 0 ? DEFAULT_COLLATERAL_BPS : _collateralBps;
            if (collateralBps < MIN_COLLATERAL_BPS || collateralBps > MAX_COLLATERAL_BPS) {
                revert InvalidCollateralBps();
            }
            collateralAmount = (_amount * collateralBps) / BPS_BASE;
            uint256 maturityDays = _maturityDays == 0 ? DEFAULT_MATURITY_DAYS : _maturityDays;
            maturityDate = block.timestamp + maturityDays * 1 days;
        } else {
            collateralAmount = _amount;
            collateralBps = BPS_BASE;
            maturityDate = 0;
        }

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
            feeRate: feeRate,
            mode: _mode,
            faceValue: _amount,
            collateralAmount: collateralAmount,
            collateralBps: collateralBps,
            maturityDate: maturityDate,
            commitmentFulfilled: false
        });

        escrowExists[escrowId] = true;
        emit EscrowCreated(escrowId, msg.sender, _seller, _amount, _token, uint8(_mode), _amount);
        return escrowId;
    }

    /// @notice Internal function to release funds with fee deduction (seller wins)
    function _releaseFunds(uint256 _escrowId, address _recipient) internal {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (
            txn.state != EscrowTypes.State.FUNDED && txn.state != EscrowTypes.State.DISPUTED
                && txn.state != EscrowTypes.State.ESCALATED
        ) {
            revert InvalidState();
        }

        txn.state = EscrowTypes.State.RELEASED;

        uint256 payoutAmount = txn.commitmentFulfilled ? txn.amount : txn.collateralAmount;
        uint256 feeAmount = (payoutAmount * txn.feeRate) / 1000;
        uint256 recipientAmount = payoutAmount - feeAmount;

        successfulTrades[_recipient]++;
        successfulTrades[txn.buyer]++;

        _settleReceivable(_escrowId);

        _transferFunds(txn.token, _recipient, recipientAmount);
        _transferFunds(txn.token, feeRecipient, feeAmount);

        emit EscrowSettled(_escrowId, _recipient, recipientAmount, feeAmount);
    }

    /// @notice Internal function to refund funds to buyer (buyer wins)
    function _refundFunds(uint256 _escrowId, address _recipient) internal {
        EscrowTypes.EscrowTransaction storage txn = escrows[_escrowId];
        if (
            txn.state != EscrowTypes.State.FUNDED && txn.state != EscrowTypes.State.DISPUTED
                && txn.state != EscrowTypes.State.ESCALATED
        ) {
            revert InvalidState();
        }

        txn.state = EscrowTypes.State.REFUNDED;

        uint256 refundAmount = txn.commitmentFulfilled ? txn.amount : txn.collateralAmount;

        _settleReceivable(_escrowId);

        _transferFunds(txn.token, _recipient, refundAmount);

        emit EscrowRefunded(_escrowId, _recipient, refundAmount);
    }

    function _settleReceivable(uint256 _escrowId) internal {
        uint256 tokenId = escrowToReceivableTokenId[_escrowId];
        if (tokenId != 0 && receivableMinter != address(0)) {
            try IReceivableMinter(receivableMinter).settleReceivable(tokenId) {} catch {}
        }
    }

    function _transferFunds(address token, address recipient, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool sent,) = payable(recipient).call{value: amount}("");
            if (!sent) revert ETHTransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function _computeMerkleRoot(bytes32 h1, bytes32 h2, bytes32 h3, bytes32 h4) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](4);
        uint256 count = 0;
        if (h1 != bytes32(0)) leaves[count++] = h1;
        if (h2 != bytes32(0)) leaves[count++] = h2;
        if (h3 != bytes32(0)) leaves[count++] = h3;
        if (h4 != bytes32(0)) leaves[count++] = h4;

        if (count == 0) return bytes32(0);
        if (count == 1) return leaves[0];

        while (count > 1) {
            uint256 newCount = 0;
            for (uint256 i = 0; i < count; i += 2) {
                if (i + 1 < count) {
                    leaves[newCount++] = keccak256(abi.encodePacked(leaves[i], leaves[i + 1]));
                } else {
                    leaves[newCount++] = leaves[i];
                }
            }
            count = newCount;
        }

        return leaves[0];
    }

    function _getTierCeiling(EscrowTypes.DeploymentTier tier) internal view returns (uint256) {
        if (tier == EscrowTypes.DeploymentTier.LAUNCH) return launchLimit;
        if (tier == EscrowTypes.DeploymentTier.GROWTH) return growthLimit;
        if (tier == EscrowTypes.DeploymentTier.MATURE) return matureLimit;
        return type(uint256).max; // TESTNET
    }

    // ============ View Functions ============

    /// @notice Retrieve full escrow transaction details
    /// @param _escrowId ID of the escrow
    /// @return The escrow transaction struct
    function getEscrow(uint256 _escrowId) external view returns (EscrowTypes.EscrowTransaction memory) {
        if (!escrowExists[_escrowId]) revert EscrowNotFound();
        return escrows[_escrowId];
    }

    /// @notice Return the total number of escrows created
    /// @return Total escrow count
    function getEscrowCount() external view returns (uint256) {
        return nextEscrowId;
    }

    /// @notice Get the reputation tier for a user based on trade history
    /// @param _user Address to look up
    /// @return The user's current reputation tier
    function getUserTier(address _user) public view returns (EscrowTypes.UserTier) {
        return ReputationLibrary.getUserTier(successfulTrades[_user], disputesLost[_user]);
    }

    /// @notice Get the per-mille fee rate for a user based on their reputation tier
    /// @param _user Address to look up
    /// @return Fee rate in per-mille (e.g. 30 = 3.0%)
    function getUserFeeRate(address _user) external view returns (uint256) {
        EscrowTypes.UserTier tier = ReputationLibrary.getUserTier(successfulTrades[_user], disputesLost[_user]);
        return ReputationLibrary.getFeeRate(tier);
    }

    /// @notice Get a user's reputation statistics
    /// @param _user Address to look up
    /// @return trades Number of successful trades
    /// @return initiated Number of disputes initiated
    /// @return lost Number of disputes lost
    function getUserStats(address _user) external view returns (uint256 trades, uint256 initiated, uint256 lost) {
        return (successfulTrades[_user], disputesInitiated[_user], disputesLost[_user]);
    }

    /// @notice Get the receivable NFT token ID minted for an escrow
    /// @param _escrowId ID of the escrow
    /// @return Token ID (0 if no receivable was minted)
    function getReceivableTokenId(uint256 _escrowId) external view returns (uint256) {
        return escrowToReceivableTokenId[_escrowId];
    }
}
