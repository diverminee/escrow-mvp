// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CentralizedTradeOracle} from "../src/CentralizedTradeOracle.sol";

/// @notice Tests for CentralizedTradeOracle: submitVerification, getDocumentVerification, transferOwnership
contract CentralizedTradeOracleTest is Test {
    CentralizedTradeOracle internal oracle;

    address internal owner = makeAddr("owner");
    address internal newOwner = makeAddr("newOwner");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant TRADE_DATA_HASH = keccak256("trade-data");
    bytes32 internal constant MERKLE_ROOT = keccak256("merkle-root");

    // ═══════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════

    function setUp() public {
        oracle = new CentralizedTradeOracle(owner);
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(oracle.owner(), owner);
    }

    function testRevert_Constructor_ZeroOwner() public {
        vm.expectRevert(CentralizedTradeOracle.ZeroAddress.selector);
        new CentralizedTradeOracle(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // submitVerification — 2-param version
    // ═══════════════════════════════════════════════════════════════════

    function test_SubmitVerification_2Param_Verified() public {
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);

        assertTrue(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function test_SubmitVerification_2Param_Rejected() public {
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, false);

        assertFalse(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function test_SubmitVerification_2Param_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CentralizedTradeOracle.TradeVerified(TRADE_DATA_HASH, true);
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);
    }

    function test_SubmitVerification_2Param_OverwritesPrevious() public {
        // First verify as true
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);
        assertTrue(oracle.verifyTradeData(TRADE_DATA_HASH));

        // Overwrite to false
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, false);
        assertFalse(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function testRevert_SubmitVerification_2Param_NotOwner() public {
        vm.expectRevert(CentralizedTradeOracle.NotOwner.selector);
        vm.prank(stranger);
        oracle.submitVerification(TRADE_DATA_HASH, true);
    }

    // ═══════════════════════════════════════════════════════════════════
    // submitVerification — 3-param version (with documentFlags)
    // ═══════════════════════════════════════════════════════════════════

    function test_SubmitVerification_3Param_Verified() public {
        bytes32[] memory flags = new bytes32[](2);
        flags[0] = bytes32(uint256(1)); // 0x01 = verified
        flags[1] = bytes32(uint256(1)); // 0x01 = verified

        vm.prank(owner);
        oracle.submitVerification(MERKLE_ROOT, true, flags);

        assertTrue(oracle.verifyTradeData(MERKLE_ROOT));
    }

    function test_SubmitVerification_3Param_Rejected() public {
        bytes32[] memory flags = new bytes32[](2);
        flags[0] = bytes32(uint256(0)); // 0x00 = failed
        flags[1] = bytes32(uint256(1)); // 0x01 = verified

        vm.prank(owner);
        oracle.submitVerification(MERKLE_ROOT, false, flags);

        assertFalse(oracle.verifyTradeData(MERKLE_ROOT));
    }

    function test_SubmitVerification_3Param_StoresDocumentFlags() public {
        bytes32[] memory flags = new bytes32[](3);
        flags[0] = bytes32(uint256(1));
        flags[1] = bytes32(uint256(0));
        flags[2] = bytes32(uint256(1));

        vm.prank(owner);
        oracle.submitVerification(MERKLE_ROOT, true, flags);

        (bool overallResult, bytes32[] memory returnedFlags) = oracle.getDocumentVerification(MERKLE_ROOT);

        assertTrue(overallResult);
        assertEq(returnedFlags.length, 3);
        assertEq(returnedFlags[0], flags[0]);
        assertEq(returnedFlags[1], flags[1]);
        assertEq(returnedFlags[2], flags[2]);
    }

    function test_SubmitVerification_3Param_EmitsEvent() public {
        bytes32[] memory flags = new bytes32[](1);
        flags[0] = bytes32(uint256(1));

        vm.expectEmit(true, true, false, true);
        emit CentralizedTradeOracle.TradeVerified(MERKLE_ROOT, true);
        vm.prank(owner);
        oracle.submitVerification(MERKLE_ROOT, true, flags);
    }

    function testRevert_SubmitVerification_3Param_NotOwner() public {
        bytes32[] memory flags = new bytes32[](1);
        flags[0] = bytes32(uint256(1));

        vm.expectRevert(CentralizedTradeOracle.NotOwner.selector);
        vm.prank(stranger);
        oracle.submitVerification(MERKLE_ROOT, true, flags);
    }

    // ═══════════════════════════════════════════════════════════════════
    // getDocumentVerification
    // ═══════════════════════════════════════════════════════════════════

    function test_GetDocumentVerification_NoFlags() public {
        // Submit verification without document flags
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);

        (bool result, bytes32[] memory flags) = oracle.getDocumentVerification(TRADE_DATA_HASH);

        assertTrue(result);
        assertEq(flags.length, 0);
    }

    function test_GetDocumentVerification_WithFlags() public {
        bytes32[] memory flags = new bytes32[](4);
        flags[0] = bytes32(uint256(1));
        flags[1] = bytes32(uint256(1));
        flags[2] = bytes32(uint256(0));
        flags[3] = bytes32(uint256(1));

        vm.prank(owner);
        oracle.submitVerification(MERKLE_ROOT, false, flags);

        (bool result, bytes32[] memory returnedFlags) = oracle.getDocumentVerification(MERKLE_ROOT);

        assertFalse(result);
        assertEq(returnedFlags.length, 4);
        assertEq(returnedFlags[0], bytes32(uint256(1)));
        assertEq(returnedFlags[1], bytes32(uint256(1)));
        assertEq(returnedFlags[2], bytes32(uint256(0)));
        assertEq(returnedFlags[3], bytes32(uint256(1)));
    }

    function test_GetDocumentVerification_NonExistent() public {
        bytes32 nonExistent = keccak256("non-existent");
        (bool result, bytes32[] memory flags) = oracle.getDocumentVerification(nonExistent);

        assertFalse(result);
        assertEq(flags.length, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // verifyTradeData (ITradeOracle interface)
    // ═══════════════════════════════════════════════════════════════════

    function test_VerifyTradeData_NotVerified() public view {
        assertFalse(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function test_VerifyTradeData_AfterVerification() public {
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);

        assertTrue(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function test_VerifyTradeData_MultipleTrades() public {
        bytes32 trade1 = keccak256("trade1");
        bytes32 trade2 = keccak256("trade2");
        bytes32 trade3 = keccak256("trade3");

        vm.prank(owner);
        oracle.submitVerification(trade1, true);
        vm.prank(owner);
        oracle.submitVerification(trade2, false);
        // trade3 not verified

        assertTrue(oracle.verifyTradeData(trade1));
        assertFalse(oracle.verifyTradeData(trade2));
        assertFalse(oracle.verifyTradeData(trade3));
    }

    // ═══════════════════════════════════════════════════════════════════
    // transferOwnership
    // ═══════════════════════════════════════════════════════════════════

    function test_TransferOwnership_Success() public {
        vm.prank(owner);
        oracle.transferOwnership(newOwner);

        assertEq(oracle.owner(), newOwner);
    }

    function test_TransferOwnership_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CentralizedTradeOracle.OwnershipTransferred(owner, newOwner);
        vm.prank(owner);
        oracle.transferOwnership(newOwner);
    }

    function testRevert_TransferOwnership_NotOwner() public {
        vm.expectRevert(CentralizedTradeOracle.NotOwner.selector);
        vm.prank(stranger);
        oracle.transferOwnership(newOwner);
    }

    function testRevert_TransferOwnership_ZeroAddress() public {
        vm.expectRevert(CentralizedTradeOracle.ZeroAddress.selector);
        vm.prank(owner);
        oracle.transferOwnership(address(0));
    }

    function test_TransferOwnership_CanTransferToEOA() public {
        address eoa = makeAddr("eoa");
        vm.prank(owner);
        oracle.transferOwnership(eoa);
        assertEq(oracle.owner(), eoa);
    }

    function test_TransferOwnership_NewOwnerCanSubmitVerification() public {
        vm.prank(owner);
        oracle.transferOwnership(newOwner);

        // New owner can now submit verifications
        vm.prank(newOwner);
        oracle.submitVerification(TRADE_DATA_HASH, true);

        assertTrue(oracle.verifyTradeData(TRADE_DATA_HASH));
    }

    function test_TransferOwnership_OldOwnerCannotSubmit() public {
        vm.prank(owner);
        oracle.transferOwnership(newOwner);

        // Old owner should no longer be able to submit
        vm.expectRevert(CentralizedTradeOracle.NotOwner.selector);
        vm.prank(owner);
        oracle.submitVerification(TRADE_DATA_HASH, true);
    }
}
