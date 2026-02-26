// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {ITradeOracle} from "./interfaces/ITradeOracle.sol";

/// @title ChainlinkTradeOracle
/// @notice Decentralized trade verification oracle using Chainlink Functions
/// @dev Drop-in replacement for CentralizedTradeOracle implementing ITradeOracle
contract ChainlinkTradeOracle is FunctionsClient, ITradeOracle {
    using FunctionsRequest for FunctionsRequest.Request;

    // ============ Errors ============
    error OnlyOwner();
    error RequestAlreadyPending();
    error RequestNotExpired();
    error EmptyTrackingReference();
    error ZeroAddress();

    // ============ Events ============
    event VerificationRequested(bytes32 indexed tradeDataHash, bytes32 indexed requestId);
    event VerificationFulfilled(bytes32 indexed tradeDataHash, bool result);
    event SourceUpdated(string newSource);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ State Variables ============
    address public owner;

    uint64 public immutable subscriptionId;
    bytes32 public immutable donId;
    uint32 public callbackGasLimit;

    /// @notice JavaScript source code sent to Chainlink Functions DON
    string public source;

    /// @notice Timeout after which a pending request can be re-submitted (24h)
    uint256 public constant REQUEST_TIMEOUT = 24 hours;

    struct VerificationRequest {
        bytes32 tradeDataHash;
        uint256 requestedAt;
        bool fulfilled;
        bool result;
    }

    /// @notice requestId => VerificationRequest
    mapping(bytes32 => VerificationRequest) public requests;

    /// @notice tradeDataHash => latest requestId (for lookup)
    mapping(bytes32 => bytes32) public latestRequestId;

    /// @notice tradeDataHash => verified result (the ITradeOracle answer)
    mapping(bytes32 => bool) public verificationResults;

    /// @notice tradeDataHash => whether any result has been stored
    mapping(bytes32 => bool) public hasResult;

    // ============ Constructor ============
    /// @notice Deploy the Chainlink Functions trade oracle
    /// @param _router Chainlink Functions router address
    /// @param _subscriptionId Chainlink Functions subscription ID
    /// @param _donId Chainlink Functions DON ID
    /// @param _callbackGasLimit Gas limit for the fulfillment callback
    /// @param _source JavaScript source code for the Functions request
    constructor(
        address _router,
        uint64 _subscriptionId,
        bytes32 _donId,
        uint32 _callbackGasLimit,
        string memory _source
    ) FunctionsClient(_router) {
        owner = msg.sender;
        subscriptionId = _subscriptionId;
        donId = _donId;
        callbackGasLimit = _callbackGasLimit;
        source = _source;
    }

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ External Functions ============

    /// @notice Request verification of trade data via Chainlink Functions
    /// @dev Restricted to owner to prevent unauthorized subscription drain
    /// @param tradeDataHash The trade data hash to verify
    /// @param trackingReference Shipping tracking reference passed to the JS source
    function requestVerification(bytes32 tradeDataHash, string calldata trackingReference) external onlyOwner {
        if (bytes(trackingReference).length == 0) {
            revert EmptyTrackingReference();
        }

        // Check if there's already a pending request
        bytes32 existingRequestId = latestRequestId[tradeDataHash];
        if (existingRequestId != bytes32(0)) {
            VerificationRequest storage existing = requests[existingRequestId];
            if (!existing.fulfilled) {
                // Block re-request until timeout
                if (block.timestamp < existing.requestedAt + REQUEST_TIMEOUT) {
                    revert RequestAlreadyPending();
                }
                // Timeout expired — allow re-request
            }
        }

        // Build the Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);

        string[] memory args = new string[](1);
        args[0] = trackingReference;
        req.setArgs(args);

        bytes32 requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);

        requests[requestId] = VerificationRequest({
            tradeDataHash: tradeDataHash,
            requestedAt: block.timestamp,
            fulfilled: false,
            result: false
        });

        latestRequestId[tradeDataHash] = requestId;
        emit VerificationRequested(tradeDataHash, requestId);
    }

    /// @notice ITradeOracle implementation — returns stored verification result
    /// @param tradeDataHash Hash of the trade data to verify
    /// @return bool True if trade data has been verified as valid
    function verifyTradeData(bytes32 tradeDataHash) external view override returns (bool) {
        if (!hasResult[tradeDataHash]) return false;
        return verificationResults[tradeDataHash];
    }

    /// @notice Verify trade data with individual document hashes
    /// @dev For Chainlink oracle, delegates to stored verification result
    /// @param tradeDataHash Original trade data hash
    /// @param invoiceHash Hash of commercial invoice
    /// @param bolHash Hash of bill of lading
    /// @param packingHash Hash of packing list
    /// @param cooHash Hash of certificate of origin
    /// @return bool True if trade data is verified
    function verifyTradeDataWithDocuments(
        bytes32 tradeDataHash,
        bytes32 invoiceHash,
        bytes32 bolHash,
        bytes32 packingHash,
        bytes32 cooHash
    ) external view override returns (bool) {
        // Chainlink oracle verifies the tradeDataHash, individual doc hashes
        // are verified off-chain by the JS source
        if (!hasResult[tradeDataHash]) return false;
        return verificationResults[tradeDataHash];
    }

    /// @notice Check if a verification request is pending for a trade
    /// @param tradeDataHash The trade data hash
    /// @return pending True if a request is in-flight
    /// @return requestId The pending request ID (bytes32(0) if none)
    function getPendingRequest(bytes32 tradeDataHash) external view returns (bool pending, bytes32 requestId) {
        requestId = latestRequestId[tradeDataHash];
        if (requestId != bytes32(0)) {
            pending = !requests[requestId].fulfilled;
        }
    }

    // ============ Admin Functions ============

    /// @notice Update the JavaScript source code for future requests
    /// @param _source New JavaScript source code
    function setSource(string calldata _source) external onlyOwner {
        source = _source;
        emit SourceUpdated(_source);
    }

    /// @notice Update the callback gas limit
    /// @param _callbackGasLimit New gas limit
    function setCallbackGasLimit(uint32 _callbackGasLimit) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
    }

    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ============ Internal Chainlink Callback ============

    /// @notice Called by the Chainlink Functions router with the response
    /// @param requestId The request ID
    /// @param response Aggregated response (abi-encoded bool)
    /// @param err Error bytes (non-empty if the request failed)
    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        VerificationRequest storage req = requests[requestId];
        // Ignore unknown requestIds (req.tradeDataHash will be bytes32(0))
        if (req.tradeDataHash == bytes32(0)) return;
        if (req.fulfilled) return;

        req.fulfilled = true;

        if (err.length == 0 && response.length > 0) {
            // Decode the boolean result from the response
            bool result = abi.decode(response, (bool));
            req.result = result;
            verificationResults[req.tradeDataHash] = result;
            hasResult[req.tradeDataHash] = true;
            emit VerificationFulfilled(req.tradeDataHash, result);
        } else {
            // Request failed: store false
            req.result = false;
            verificationResults[req.tradeDataHash] = false;
            hasResult[req.tradeDataHash] = true;
            emit VerificationFulfilled(req.tradeDataHash, false);
        }
    }
}
