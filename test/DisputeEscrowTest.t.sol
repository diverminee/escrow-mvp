// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {BaseEscrow} from "../src/core/BaseEscrow.sol";
import {DisputeEscrow} from "../src/core/DisputeEscrow.sol";

/// @notice Tests for DisputeEscrow: raiseDispute, resolveDispute, escalation, timeout
contract DisputeEscrowTest is EscrowTestBase {
    // ═══════════════════════════════════════════════════════════════════
    // raiseDispute
    // ═══════════════════════════════════════════════════════════════════

    function test_RaiseDispute_ByBuyer() public {
        uint256 id = _fundedETHEscrow();
        vm.prank(buyer);
        escrow.raiseDispute(id);
        _assertState(id, EscrowTypes.State.DISPUTED);
    }

    function test_RaiseDispute_BySeller() public {
        uint256 id = _fundedETHEscrow();
        vm.prank(seller);
        escrow.raiseDispute(id);
        _assertState(id, EscrowTypes.State.DISPUTED);
    }

    function test_RaiseDispute_SetsDeadline() public {
        uint256 id = _fundedETHEscrow();
        uint256 expected = block.timestamp + DISPUTE_TIMELOCK;
        vm.prank(buyer);
        escrow.raiseDispute(id);
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(txn.disputeDeadline, expected);
    }

    function test_RaiseDispute_TracksInitiation() public {
        uint256 id = _fundedETHEscrow();
        vm.prank(buyer);
        escrow.raiseDispute(id);
        (, uint256 initiated, ) = escrow.getUserStats(buyer);
        assertEq(initiated, 1);
    }

    function test_RaiseDispute_EmitsEvent() public {
        uint256 id = _fundedETHEscrow();
        uint256 expectedDeadline = block.timestamp + DISPUTE_TIMELOCK;
        vm.expectEmit(true, true, false, true);
        emit DisputeEscrow.DisputeRaised(id, buyer, expectedDeadline);
        vm.prank(buyer);
        escrow.raiseDispute(id);
    }

    function testRevert_RaiseDispute_NotAParty() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(DisputeEscrow.NotAParty.selector);
        vm.prank(stranger);
        escrow.raiseDispute(id);
    }

    function testRevert_RaiseDispute_WrongState_Draft() public {
        uint256 id = _createETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.raiseDispute(id);
    }

    function testRevert_RaiseDispute_WrongState_AlreadyDisputed() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.raiseDispute(id);
    }

    function testRevert_RaiseDispute_TooManyDisputes_HardLimit() public {
        // Artificially exhaust dispute allowance by creating separate funded escrows
        // then having the stranger raise disputes – actually we need buyer to hit limit.
        // We'll set up 10 escrows with different sellers and exhaust buyer's limit.
        address[] memory sellers = new address[](10);
        for (uint256 i = 0; i < 10; i++) {
            sellers[i] = makeAddr(string(abi.encodePacked("seller", i)));
            escrow.setKYCStatus(sellers[i], true); // KYC each generated seller
        }
        // Fund and raise dispute for 10 escrows (buyer initiates all 10)
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(buyer);
            uint256 id = escrow.createEscrow(
                sellers[i],
                arbiter,
                address(0),
                ESCROW_AMOUNT,
                i,
                TRADE_DATA_HASH
            );
            vm.prank(buyer);
            escrow.fund{value: ESCROW_AMOUNT}(id);
            vm.prank(buyer);
            escrow.raiseDispute(id);
        }
        // 11th escrow
        address extraSeller = makeAddr("extraSeller");
        escrow.setKYCStatus(extraSeller, true);
        vm.prank(buyer);
        uint256 id11 = escrow.createEscrow(
            extraSeller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            99,
            TRADE_DATA_HASH
        );
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id11);

        vm.expectRevert(DisputeEscrow.TooManyDisputes.selector);
        vm.prank(buyer);
        escrow.raiseDispute(id11);
    }

    function testRevert_RaiseDispute_TooManyDisputes_LossRate() public {
        // Give buyer 3 losses out of 3 disputes (100% loss rate, >= 3 losses)
        // We'll manipulate via resolveDispute calls on funded escrows
        // buyer creates 3 escrows, arbiter rules against buyer all 3
        for (uint256 i = 0; i < 3; i++) {
            address s = makeAddr(string(abi.encodePacked("s", i)));
            escrow.setKYCStatus(s, true); // KYC the generated seller
            vm.prank(buyer);
            uint256 id = escrow.createEscrow(
                s,
                arbiter,
                address(0),
                ESCROW_AMOUNT,
                i,
                TRADE_DATA_HASH
            );
            vm.prank(buyer);
            escrow.fund{value: ESCROW_AMOUNT}(id);
            vm.prank(buyer);
            escrow.raiseDispute(id);
            // Arbiter rules in favor of seller (buyer loses)
            vm.prank(arbiter);
            escrow.resolveDispute(id, 1);
        }
        // Buyer now has 3 losses, 3 disputes initiated → 100% loss rate
        // 4th escrow: should be blocked
        address s4 = makeAddr("s4");
        escrow.setKYCStatus(s4, true);
        vm.prank(buyer);
        uint256 id4 = escrow.createEscrow(
            s4,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            10,
            TRADE_DATA_HASH
        );
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id4);

        vm.expectRevert(DisputeEscrow.TooManyDisputes.selector);
        vm.prank(buyer);
        escrow.raiseDispute(id4);
    }

    function test_CanRaiseDispute_True() public view {
        assertTrue(escrow.canRaiseDispute(buyer));
    }

    function test_CanRaiseDispute_False_HardLimit() public {
        for (uint256 i = 0; i < 10; i++) {
            address s = makeAddr(string(abi.encodePacked("sl", i)));
            escrow.setKYCStatus(s, true); // KYC the generated seller
            vm.prank(buyer);
            uint256 id = escrow.createEscrow(
                s,
                arbiter,
                address(0),
                ESCROW_AMOUNT,
                i,
                TRADE_DATA_HASH
            );
            vm.prank(buyer);
            escrow.fund{value: ESCROW_AMOUNT}(id);
            vm.prank(buyer);
            escrow.raiseDispute(id);
        }
        assertFalse(escrow.canRaiseDispute(buyer));
    }

    // ═══════════════════════════════════════════════════════════════════
    // resolveDispute
    // ═══════════════════════════════════════════════════════════════════

    function test_ResolveDispute_Ruling1_ReleasesToSeller() public {
        uint256 id = _disputedETHEscrow();
        uint256 sellerBefore = seller.balance;

        vm.prank(arbiter);
        escrow.resolveDispute(id, 1);

        _assertState(id, EscrowTypes.State.RELEASED);
        // Seller receives funds minus fee (BRONZE = 1.2%)
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000;
        assertEq(seller.balance, sellerBefore + ESCROW_AMOUNT - feeAmount);
        assertEq(feeRecipient.balance, feeAmount);
    }

    function test_ResolveDispute_Ruling1_TracksBuyerLoss() public {
        uint256 id = _disputedETHEscrow();
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1);
        (, , uint256 lost) = escrow.getUserStats(buyer);
        assertEq(lost, 1);
    }

    function test_ResolveDispute_Ruling2_RefundsToBuyer() public {
        uint256 id = _disputedETHEscrow();
        uint256 buyerBefore = buyer.balance;

        vm.prank(arbiter);
        escrow.resolveDispute(id, 2);

        _assertState(id, EscrowTypes.State.REFUNDED);
        assertEq(buyer.balance, buyerBefore + ESCROW_AMOUNT);
    }

    function test_ResolveDispute_Ruling2_TracksSellerLoss() public {
        uint256 id = _disputedETHEscrow();
        vm.prank(arbiter);
        escrow.resolveDispute(id, 2);
        (, , uint256 lost) = escrow.getUserStats(seller);
        assertEq(lost, 1);
    }

    function test_ResolveDispute_EmitsEvent() public {
        uint256 id = _disputedETHEscrow();
        vm.expectEmit(true, true, false, false);
        emit DisputeEscrow.DisputeResolved(id, 1);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1);
    }

    function testRevert_ResolveDispute_NotArbiter() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.NotTheArbiter.selector);
        vm.prank(stranger);
        escrow.resolveDispute(id, 1);
    }

    function testRevert_ResolveDispute_WrongState_Funded() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1);
    }

    function testRevert_ResolveDispute_InvalidRuling() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.InvalidRuling.selector);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 3);
    }

    function testRevert_ResolveDispute_Ruling0() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.InvalidRuling.selector);
        vm.prank(arbiter);
        escrow.resolveDispute(id, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // escalateToProtocol
    // ═══════════════════════════════════════════════════════════════════

    function test_EscalateToProtocol_ByBuyer() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
        _assertState(id, EscrowTypes.State.ESCALATED);
    }

    function test_EscalateToProtocol_BySeller() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.prank(seller);
        escrow.escalateToProtocol(id);
        _assertState(id, EscrowTypes.State.ESCALATED);
    }

    function test_EscalateToProtocol_SetsNewDeadline() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        uint256 expectedDeadline = block.timestamp + ESCALATION_TIMELOCK;
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(txn.disputeDeadline, expectedDeadline);
    }

    function test_EscalateToProtocol_EmitsEvent() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.expectEmit(true, true, false, false);
        emit DisputeEscrow.DisputeEscalated(
            id,
            buyer,
            block.timestamp + ESCALATION_TIMELOCK
        );
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
    }

    function testRevert_EscalateToProtocol_TooEarly() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.DisputeNotExpired.selector);
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
    }

    function testRevert_EscalateToProtocol_WrongState_Funded() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
    }

    function testRevert_EscalateToProtocol_NotParty() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.expectRevert(DisputeEscrow.NotAParty.selector);
        vm.prank(stranger);
        escrow.escalateToProtocol(id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // resolveEscalation
    // ═══════════════════════════════════════════════════════════════════

    function test_ResolveEscalation_Ruling1_ReleasesToSeller() public {
        uint256 id = _escalatedETHEscrow();
        uint256 sellerBefore = seller.balance;

        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 1);

        _assertState(id, EscrowTypes.State.RELEASED);
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000;
        assertEq(seller.balance, sellerBefore + ESCROW_AMOUNT - feeAmount);
    }

    function test_ResolveEscalation_Ruling2_RefundsToBuyer() public {
        uint256 id = _escalatedETHEscrow();
        uint256 buyerBefore = buyer.balance;

        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 2);

        _assertState(id, EscrowTypes.State.REFUNDED);
        assertEq(buyer.balance, buyerBefore + ESCROW_AMOUNT);
    }

    function test_ResolveEscalation_EmitsEvent() public {
        uint256 id = _escalatedETHEscrow();
        vm.expectEmit(true, true, false, false);
        emit DisputeEscrow.EscalationResolved(id, 2);
        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 2);
    }

    function testRevert_ResolveEscalation_NotProtocolArbiter() public {
        uint256 id = _escalatedETHEscrow();
        vm.expectRevert(DisputeEscrow.NotProtocolArbiter.selector);
        vm.prank(stranger);
        escrow.resolveEscalation(id, 1);
    }

    function testRevert_ResolveEscalation_InvalidRuling() public {
        uint256 id = _escalatedETHEscrow();
        vm.expectRevert(DisputeEscrow.InvalidRuling.selector);
        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 0);
    }

    function testRevert_ResolveEscalation_WrongState_Disputed() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.NotEscalated.selector);
        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 1);
    }

    function testRevert_ResolveEscalation_EscrowNotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        vm.prank(protocolArb);
        escrow.resolveEscalation(999, 1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // claimTimeout
    // ═══════════════════════════════════════════════════════════════════

    function test_ClaimTimeout_RefundsToBuyer() public {
        uint256 id = _escalatedETHEscrow();
        uint256 buyerBefore = buyer.balance;

        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        vm.warp(txn.disputeDeadline + 1);

        vm.prank(stranger); // anyone can claim
        escrow.claimTimeout(id);

        _assertState(id, EscrowTypes.State.REFUNDED);
        assertEq(buyer.balance, buyerBefore + ESCROW_AMOUNT);
    }

    function test_ClaimTimeout_EmitsEvent() public {
        uint256 id = _escalatedETHEscrow();
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        vm.warp(txn.disputeDeadline + 1);

        vm.expectEmit(true, true, true, false);
        emit DisputeEscrow.TimeoutClaimed(id, stranger, buyer);
        vm.prank(stranger);
        escrow.claimTimeout(id);
    }

    function testRevert_ClaimTimeout_TooEarly() public {
        uint256 id = _escalatedETHEscrow();
        vm.expectRevert(DisputeEscrow.EscalationNotExpired.selector);
        vm.prank(stranger);
        escrow.claimTimeout(id);
    }

    function testRevert_ClaimTimeout_WrongState_Disputed() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(DisputeEscrow.NotEscalated.selector);
        vm.prank(stranger);
        escrow.claimTimeout(id);
    }

    function testRevert_ClaimTimeout_EscrowNotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        escrow.claimTimeout(999);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Reputation updates after dispute resolution
    // ═══════════════════════════════════════════════════════════════════

    function test_Reputation_SuccessfulTradesIncrementedOnRelease() public {
        uint256 id = _disputedETHEscrow();
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1); // seller wins

        (uint256 sellerTrades, , ) = escrow.getUserStats(seller);
        (uint256 buyerTrades, , ) = escrow.getUserStats(buyer);
        assertEq(sellerTrades, 1, "seller trades");
        assertEq(buyerTrades, 1, "buyer trades");
    }

    function test_Reputation_SuccessfulTradesIncrementedOnRefund() public {
        uint256 id = _disputedETHEscrow();
        vm.prank(arbiter);
        escrow.resolveDispute(id, 2); // buyer wins

        (uint256 buyerTrades, , ) = escrow.getUserStats(buyer);
        assertEq(
            buyerTrades,
            0,
            "buyer trades: refund should not count as successful trade"
        );
    }
}
