// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {BaseEscrow} from "../src/core/BaseEscrow.sol";

/// @notice Tests for BaseEscrow: constructor, createEscrow, fund, view functions
contract BaseEscrowTest is EscrowTestBase {
    // ═══════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════

    function test_Constructor_SetsAddresses() public view {
        assertEq(address(escrow.oracle()), address(oracle));
        assertEq(escrow.feeRecipient(), feeRecipient);
        assertEq(escrow.protocolArbiter(), protocolArb);
    }

    function testRevert_Constructor_ZeroOracle() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        new TradeInfraEscrow(address(0), feeRecipient, protocolArb);
    }

    function testRevert_Constructor_ZeroFeeRecipient() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        new TradeInfraEscrow(address(oracle), address(0), protocolArb);
    }

    function testRevert_Constructor_ZeroProtocolArbiter() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        new TradeInfraEscrow(address(oracle), feeRecipient, address(0));
    }

    function testRevert_Constructor_FeeRecipientEqualsProtocol() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        new TradeInfraEscrow(address(oracle), feeRecipient, feeRecipient);
    }

    // ═══════════════════════════════════════════════════════════════════
    // createEscrow — happy paths
    // ═══════════════════════════════════════════════════════════════════

    function test_CreateEscrow_ETH() public {
        vm.prank(buyer);
        uint256 id = escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );

        assertEq(id, 0);
        assertEq(escrow.getEscrowCount(), 1);

        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(txn.buyer, buyer);
        assertEq(txn.seller, seller);
        assertEq(txn.arbiter, arbiter);
        assertEq(txn.token, address(0));
        assertEq(txn.amount, ESCROW_AMOUNT);
        assertEq(txn.tradeId, TRADE_ID);
        assertEq(txn.tradeDataHash, TRADE_DATA_HASH);
        assertEq(uint8(txn.state), uint8(EscrowTypes.State.DRAFT));
        assertEq(txn.disputeDeadline, 0);
    }

    function test_CreateEscrow_ERC20() public {
        uint256 id = _createERC20Escrow();
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(txn.token, address(token));
    }

    function test_CreateEscrow_IncrementsId() public {
        _createETHEscrow();
        _createETHEscrow();
        assertEq(escrow.getEscrowCount(), 2);
    }

    function test_CreateEscrow_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit BaseEscrow.EscrowCreated(0, buyer, seller, ESCROW_AMOUNT);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // createEscrow — reverts
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_Create_ZeroSeller() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            address(0),
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_ZeroArbiter() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            address(0),
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_ZeroAmount() public {
        vm.expectRevert(BaseEscrow.InvalidAmount.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            0,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_ExceedsMax() public {
        uint256 tooMuch = escrow.MAX_ESCROW_AMOUNT() + 1;
        vm.expectRevert(BaseEscrow.AmountExceedsMaximum.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            tooMuch,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_SellerIsBuyer() public {
        vm.expectRevert(BaseEscrow.SellerCannotBeBuyer.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            buyer,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_ArbiterIsBuyer() public {
        vm.expectRevert(BaseEscrow.ArbiterCannotBeBuyer.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            buyer,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_ArbiterIsSeller() public {
        vm.expectRevert(BaseEscrow.ArbiterCannotBeSeller.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            seller,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_BuyerIsProtocolArbiter() public {
        vm.expectRevert(BaseEscrow.ProtocolArbiterCannotBeParty.selector);
        vm.prank(protocolArb);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    function testRevert_Create_SellerIsProtocolArbiter() public {
        vm.expectRevert(BaseEscrow.ProtocolArbiterCannotBeParty.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            protocolArb,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // fund — happy paths
    // ═══════════════════════════════════════════════════════════════════

    function test_Fund_ETH_ChangeState() public {
        uint256 id = _createETHEscrow();
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
        _assertState(id, EscrowTypes.State.FUNDED);
    }

    function test_Fund_ETH_ContractReceivesETH() public {
        uint256 id = _createETHEscrow();
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
        assertEq(address(escrow).balance, ESCROW_AMOUNT);
    }

    function test_Fund_ETH_EmitsEvent() public {
        uint256 id = _createETHEscrow();
        vm.expectEmit(true, false, false, true);
        emit BaseEscrow.Funded(id, ESCROW_AMOUNT);
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    function test_Fund_ERC20_ChangeState() public {
        uint256 id = _fundedERC20Escrow();
        _assertState(id, EscrowTypes.State.FUNDED);
    }

    function test_Fund_ERC20_ContractReceivesTokens() public {
        _fundedERC20Escrow();
        assertEq(token.balanceOf(address(escrow)), ESCROW_AMOUNT);
    }

    // ═══════════════════════════════════════════════════════════════════
    // fund — reverts
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_Fund_NotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(999);
    }

    function testRevert_Fund_NotBuyer() public {
        uint256 id = _createETHEscrow();
        vm.deal(stranger, 10 ether);
        vm.expectRevert(BaseEscrow.OnlyBuyerCanFund.selector);
        vm.prank(stranger);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    function testRevert_Fund_WrongState() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    function testRevert_Fund_IncorrectETHAmount() public {
        uint256 id = _createETHEscrow();
        vm.expectRevert(BaseEscrow.IncorrectETHAmount.selector);
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT - 1}(id);
    }

    function testRevert_Fund_ETHSentForERC20() public {
        uint256 id = _createERC20Escrow();
        vm.deal(buyer, 10 ether);
        vm.expectRevert(BaseEscrow.NoETHForERC20Escrow.selector);
        vm.prank(buyer);
        escrow.fund{value: 1}(id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // View functions
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_GetEscrow_NotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        escrow.getEscrow(0);
    }

    function test_GetEscrowCount_StartsAtZero() public view {
        assertEq(escrow.getEscrowCount(), 0);
    }

    function test_GetUserTier_DefaultBronze() public view {
        assertEq(
            uint8(escrow.getUserTier(buyer)),
            uint8(EscrowTypes.UserTier.BRONZE)
        );
    }

    function test_GetUserFeeRate_DefaultBronze() public view {
        // BRONZE = 12 (1.2%)
        assertEq(escrow.getUserFeeRate(buyer), 12);
    }

    function test_GetUserStats_DefaultZero() public view {
        (uint256 trades, uint256 initiated, uint256 lost) = escrow.getUserStats(
            buyer
        );
        assertEq(trades, 0);
        assertEq(initiated, 0);
        assertEq(lost, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // KYC checks
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_CreateEscrow_BuyerNotKYC() public {
        // revoke buyer's KYC (test contract is owner)
        escrow.setKYCStatus(buyer, false);
        vm.expectRevert(BaseEscrow.NotKYCApproved.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH
        );
    }

    function testRevert_CreateEscrow_SellerNotKYC() public {
        // revoke seller's KYC
        escrow.setKYCStatus(seller, false);
        vm.expectRevert(BaseEscrow.NotKYCApproved.selector);
        vm.prank(buyer);
        escrow.createEscrow(
            seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH
        );
    }

    function testRevert_SetKYCStatus_NotOwner() public {
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        vm.prank(stranger);
        escrow.setKYCStatus(buyer, false);
    }

    function test_SetKYCStatus_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit BaseEscrow.KYCStatusUpdated(stranger, true);
        escrow.setKYCStatus(stranger, true);
    }

    function test_BatchSetKYCStatus() public {
        address[] memory users = new address[](2);
        users[0] = makeAddr("u1");
        users[1] = makeAddr("u2");
        escrow.batchSetKYCStatus(users, true);
        assertTrue(escrow.kycApproved(users[0]));
        assertTrue(escrow.kycApproved(users[1]));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Token allowlist
    // ═══════════════════════════════════════════════════════════════════

    function test_AddApprovedToken() public {
        address mockToken = makeAddr("mockToken");
        assertFalse(escrow.approvedTokens(mockToken));
        escrow.addApprovedToken(mockToken);
        assertTrue(escrow.approvedTokens(mockToken));
    }

    function test_RemoveApprovedToken() public {
        address mockToken = makeAddr("mockToken");
        escrow.addApprovedToken(mockToken);
        escrow.removeApprovedToken(mockToken);
        assertFalse(escrow.approvedTokens(mockToken));
    }

    function testRevert_AddApprovedToken_NotOwner() public {
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        vm.prank(stranger);
        escrow.addApprovedToken(makeAddr("t"));
    }

    function test_AddApprovedToken_EmitsEvent() public {
        address mockToken = makeAddr("tok");
        vm.expectEmit(true, false, false, false);
        emit BaseEscrow.ApprovedTokenAdded(mockToken);
        escrow.addApprovedToken(mockToken);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Ownership
    // ═══════════════════════════════════════════════════════════════════

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        escrow.transferOwnership(newOwner);
        assertEq(escrow.owner(), newOwner);
    }

    function testRevert_TransferOwnership_NotOwner() public {
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        vm.prank(stranger);
        escrow.transferOwnership(stranger);
    }

    function testRevert_TransferOwnership_ZeroAddress() public {
        vm.expectRevert(BaseEscrow.InvalidAddresses.selector);
        escrow.transferOwnership(address(0));
    }
}
