// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkTradeOracle} from "../src/ChainlinkTradeOracle.sol";
import {MockFunctionsRouter} from "./mocks/MockFunctionsRouter.sol";

/// @notice Tests for ChainlinkTradeOracle (Chainlink Functions-based oracle)
contract ChainlinkOracleTest is Test {
    ChainlinkTradeOracle internal oracle;
    MockFunctionsRouter internal router;

    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");

    uint64 internal constant SUB_ID = 1;
    bytes32 internal constant DON_ID = bytes32("don-sepolia");
    uint32 internal constant CALLBACK_GAS = 300_000;
    string internal constant JS_SOURCE =
        "const tracking = args[0]; const res = await Functions.makeHttpRequest({url: `https://api.example.com/track/${tracking}`}); return Functions.encodeUint256(res.data.delivered ? 1 : 0);";

    bytes32 internal constant TRADE_HASH = keccak256("trade-data-hash");

    function setUp() public {
        router = new MockFunctionsRouter();
        vm.prank(owner);
        oracle = new ChainlinkTradeOracle(address(router), SUB_ID, DON_ID, CALLBACK_GAS, JS_SOURCE);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Constructor & Config
    // ═══════════════════════════════════════════════════════════════════

    function test_Constructor_SetsValues() public view {
        assertEq(oracle.owner(), owner);
        assertEq(oracle.subscriptionId(), SUB_ID);
        assertEq(oracle.donId(), DON_ID);
        assertEq(oracle.callbackGasLimit(), CALLBACK_GAS);
        assertEq(oracle.source(), JS_SOURCE);
    }

    // ═══════════════════════════════════════════════════════════════════
    // verifyTradeData — returns false before fulfillment
    // ═══════════════════════════════════════════════════════════════════

    function test_VerifyTradeData_ReturnsFalseBeforeFulfillment() public view {
        assertFalse(oracle.verifyTradeData(TRADE_HASH));
    }

    function test_VerifyTradeData_ReturnsFalseAfterRequestButBeforeCallback() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        assertFalse(oracle.verifyTradeData(TRADE_HASH));
    }

    // ═══════════════════════════════════════════════════════════════════
    // verifyTradeData — returns true after successful callback
    // ═══════════════════════════════════════════════════════════════════

    function test_VerifyTradeData_ReturnsTrueAfterSuccessfulCallback() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        // Simulate successful DON callback with true
        bytes memory response = abi.encode(true);
        router.fulfillRequest(address(oracle), requestId, response, "");

        assertTrue(oracle.verifyTradeData(TRADE_HASH));
    }

    // ═══════════════════════════════════════════════════════════════════
    // verifyTradeData — returns false after failed callback
    // ═══════════════════════════════════════════════════════════════════

    function test_VerifyTradeData_ReturnsFalseAfterFailedCallback() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        // Simulate DON error callback
        router.fulfillRequest(address(oracle), requestId, "", "request failed");

        assertFalse(oracle.verifyTradeData(TRADE_HASH));
    }

    function test_VerifyTradeData_ReturnsFalseWhenResultIsFalse() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        bytes memory response = abi.encode(false);
        router.fulfillRequest(address(oracle), requestId, response, "");

        assertFalse(oracle.verifyTradeData(TRADE_HASH));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════

    function test_RequestVerification_EmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit ChainlinkTradeOracle.VerificationRequested(TRADE_HASH, bytes32(0));
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
    }

    function test_FulfillRequest_EmitsEvent() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        vm.expectEmit(true, false, false, true);
        emit ChainlinkTradeOracle.VerificationFulfilled(TRADE_HASH, true);

        router.fulfillRequest(address(oracle), requestId, abi.encode(true), "");
    }

    // ═══════════════════════════════════════════════════════════════════
    // Pending requests
    // ═══════════════════════════════════════════════════════════════════

    function test_PendingRequest_TrueBeforeFulfillment() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        (bool pending, bytes32 requestId) = oracle.getPendingRequest(TRADE_HASH);
        assertTrue(pending);
        assertTrue(requestId != bytes32(0));
    }

    function test_PendingRequest_FalseAfterFulfillment() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        router.fulfillRequest(address(oracle), requestId, abi.encode(true), "");

        (bool pending,) = oracle.getPendingRequest(TRADE_HASH);
        assertFalse(pending);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Re-request after timeout
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_ReRequest_BeforeTimeout() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");

        vm.expectRevert(ChainlinkTradeOracle.RequestAlreadyPending.selector);
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
    }

    function test_ReRequest_AllowedAfterTimeout() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 firstRequestId = router.lastRequestId();

        vm.warp(block.timestamp + 24 hours + 1);

        // Should not revert
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK456");
        bytes32 secondRequestId = router.lastRequestId();

        assertTrue(secondRequestId != firstRequestId);
    }

    function test_ReRequest_AllowedAfterFulfillment() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        router.fulfillRequest(address(oracle), requestId, abi.encode(true), "");

        // Can re-request after fulfillment
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK456");
    }

    // ═══════════════════════════════════════════════════════════════════
    // Access control — only router can fulfill
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_HandleOracleFulfillment_NotRouter() public {
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
        bytes32 requestId = router.lastRequestId();

        // Direct call from non-router should revert
        vm.expectRevert();
        vm.prank(stranger);
        oracle.handleOracleFulfillment(requestId, abi.encode(true), "");
    }

    // ═══════════════════════════════════════════════════════════════════
    // Input validation
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_RequestVerification_EmptyTracking() public {
        vm.expectRevert(ChainlinkTradeOracle.EmptyTrackingReference.selector);
        vm.prank(owner);
        oracle.requestVerification(TRADE_HASH, "");
    }

    function testRevert_RequestVerification_NotOwner() public {
        vm.expectRevert(ChainlinkTradeOracle.OnlyOwner.selector);
        vm.prank(stranger);
        oracle.requestVerification(TRADE_HASH, "TRACK123");
    }

    // ═══════════════════════════════════════════════════════════════════
    // Admin functions
    // ═══════════════════════════════════════════════════════════════════

    function test_SetSource() public {
        string memory newSource = "return Functions.encodeUint256(1);";
        vm.prank(owner);
        oracle.setSource(newSource);
        assertEq(oracle.source(), newSource);
    }

    function testRevert_SetSource_NotOwner() public {
        vm.expectRevert(ChainlinkTradeOracle.OnlyOwner.selector);
        vm.prank(stranger);
        oracle.setSource("bad");
    }

    function test_SetCallbackGasLimit() public {
        vm.prank(owner);
        oracle.setCallbackGasLimit(500_000);
        assertEq(oracle.callbackGasLimit(), 500_000);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        oracle.transferOwnership(stranger);
        assertEq(oracle.owner(), stranger);
    }

    function testRevert_TransferOwnership_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(ChainlinkTradeOracle.ZeroAddress.selector);
        oracle.transferOwnership(address(0));
    }

    function test_TransferOwnership_EmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit ChainlinkTradeOracle.OwnershipTransferred(owner, stranger);
        vm.prank(owner);
        oracle.transferOwnership(stranger);
    }
}
