// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {BaseEscrow} from "../src/core/BaseEscrow.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";

/// @notice Tests for TradeInfraEscrow: confirmDelivery, confirmByOracle, fee tiers
contract TradeInfraEscrowTest is EscrowTestBase {
    // ═══════════════════════════════════════════════════════════════════
    // confirmDelivery — ETH
    // ═══════════════════════════════════════════════════════════════════

    function test_ConfirmDelivery_ETH_ReleasesToSeller() public {
        uint256 id = _fundedETHEscrow();
        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        escrow.confirmDelivery(id);

        _assertState(id, EscrowTypes.State.RELEASED);
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000; // BRONZE 1.2%
        assertEq(seller.balance, sellerBefore + ESCROW_AMOUNT - feeAmount);
        assertEq(feeRecipient.balance, feeAmount);
    }

    function test_ConfirmDelivery_ETH_EmitsEvents() public {
        uint256 id = _fundedETHEscrow();
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000;

        vm.expectEmit(true, false, false, false);
        emit TradeInfraEscrow.DeliveryConfirmed(id);
        vm.prank(buyer);
        escrow.confirmDelivery(id);
        // Released event emitted from _releaseFunds
        assertEq(feeRecipient.balance, feeAmount);
    }

    function test_ConfirmDelivery_ERC20_ReleasesToSeller() public {
        uint256 id = _fundedERC20Escrow();
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000;

        vm.prank(buyer);
        escrow.confirmDelivery(id);

        _assertState(id, EscrowTypes.State.RELEASED);
        assertEq(token.balanceOf(seller), ESCROW_AMOUNT - feeAmount);
        assertEq(token.balanceOf(feeRecipient), feeAmount);
    }

    function testRevert_ConfirmDelivery_NotBuyer() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(TradeInfraEscrow.OnlyBuyerCanConfirm.selector);
        vm.prank(seller);
        escrow.confirmDelivery(id);
    }

    function testRevert_ConfirmDelivery_NotBuyer_Stranger() public {
        uint256 id = _fundedETHEscrow();
        vm.expectRevert(TradeInfraEscrow.OnlyBuyerCanConfirm.selector);
        vm.prank(stranger);
        escrow.confirmDelivery(id);
    }

    function testRevert_ConfirmDelivery_WrongState_Draft() public {
        uint256 id = _createETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.confirmDelivery(id);
    }

    function testRevert_ConfirmDelivery_WrongState_Disputed() public {
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        vm.prank(buyer);
        escrow.confirmDelivery(id);
    }

    function testRevert_ConfirmDelivery_EscrowNotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        vm.prank(buyer);
        escrow.confirmDelivery(999);
    }

    // ═══════════════════════════════════════════════════════════════════
    // confirmByOracle
    // ═══════════════════════════════════════════════════════════════════

    function test_ConfirmByOracle_Success_ReleasesToSeller() public {
        oracle.setVerifyResult(true);
        uint256 id = _fundedETHEscrow();
        uint256 sellerBefore = seller.balance;

        escrow.confirmByOracle(id); // anyone can call

        _assertState(id, EscrowTypes.State.RELEASED);
        uint256 feeAmount = (ESCROW_AMOUNT * 12) / 1000;
        assertEq(seller.balance, sellerBefore + ESCROW_AMOUNT - feeAmount);
    }

    function test_ConfirmByOracle_EmitsEvent() public {
        oracle.setVerifyResult(true);
        uint256 id = _fundedETHEscrow();

        vm.expectEmit(true, false, false, false);
        emit TradeInfraEscrow.OracleConfirmed(id);
        escrow.confirmByOracle(id);
    }

    function testRevert_ConfirmByOracle_OracleFails() public {
        oracle.setVerifyResult(false);
        uint256 id = _fundedETHEscrow();

        vm.expectRevert(TradeInfraEscrow.OracleVerificationFailed.selector);
        escrow.confirmByOracle(id);
    }

    function testRevert_ConfirmByOracle_WrongState_Draft() public {
        oracle.setVerifyResult(true);
        uint256 id = _createETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        escrow.confirmByOracle(id);
    }

    function testRevert_ConfirmByOracle_WrongState_Disputed() public {
        oracle.setVerifyResult(true);
        uint256 id = _disputedETHEscrow();
        vm.expectRevert(BaseEscrow.InvalidState.selector);
        escrow.confirmByOracle(id);
    }

    function testRevert_ConfirmByOracle_EscrowNotFound() public {
        vm.expectRevert(BaseEscrow.EscrowNotFound.selector);
        escrow.confirmByOracle(999);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Reputation tiers & fee rates
    // ═══════════════════════════════════════════════════════════════════

    // Helper: complete N trades for a user to reach a tier
    function _completeTrades(
        address _buyer,
        address _seller,
        uint256 n
    ) internal {
        for (uint256 i = 0; i < n; i++) {
            vm.deal(_buyer, ESCROW_AMOUNT + 1 ether);
            vm.prank(_buyer);
            uint256 id = escrow.createEscrow(
                _seller,
                arbiter,
                address(0),
                ESCROW_AMOUNT,
                i + 1000,
                TRADE_DATA_HASH
            );
            vm.prank(_buyer);
            escrow.fund{value: ESCROW_AMOUNT}(id);
            vm.prank(_buyer);
            escrow.confirmDelivery(id);
        }
    }

    function test_FeeTier_Silver_AfterFiveTrades() public {
        address b = makeAddr("silverBuyer");
        address s = makeAddr("silverSeller");
        // Complete 5 trades → seller reaches SILVER (5 successes)
        _completeTrades(b, s, 5);

        assertEq(
            uint8(escrow.getUserTier(s)),
            uint8(EscrowTypes.UserTier.SILVER)
        );
        assertEq(escrow.getUserFeeRate(s), 9); // 0.9%
    }

    function test_FeeTier_Gold_After20Trades() public {
        address b = makeAddr("goldBuyer");
        address s = makeAddr("goldSeller");
        _completeTrades(b, s, 20);

        assertEq(
            uint8(escrow.getUserTier(s)),
            uint8(EscrowTypes.UserTier.GOLD)
        );
        assertEq(escrow.getUserFeeRate(s), 8); // 0.8%
    }

    function test_FeeTier_Diamond_After50TradesZeroLosses() public {
        address b = makeAddr("diamondBuyer");
        address s = makeAddr("diamondSeller");
        _completeTrades(b, s, 50);

        assertEq(
            uint8(escrow.getUserTier(s)),
            uint8(EscrowTypes.UserTier.DIAMOND)
        );
        assertEq(escrow.getUserFeeRate(s), 7); // 0.7%
    }

    function test_FeeTier_NoGoldWithTwoLosses() public {
        address b = makeAddr("noBuyer");
        address s = makeAddr("noGoldSeller");

        // First give seller 20 successful trades
        _completeTrades(b, s, 20);

        // Now give seller 2 losses via dispute (ruling against seller)
        for (uint256 i = 0; i < 2; i++) {
            vm.deal(b, ESCROW_AMOUNT + 1 ether);
            vm.prank(b);
            uint256 id = escrow.createEscrow(
                s,
                arbiter,
                address(0),
                ESCROW_AMOUNT,
                500 + i,
                TRADE_DATA_HASH
            );
            vm.prank(b);
            escrow.fund{value: ESCROW_AMOUNT}(id);
            vm.prank(b);
            escrow.raiseDispute(id);
            // Arbiter rules in favor of buyer (seller loses)
            vm.prank(arbiter);
            escrow.resolveDispute(id, 2);
        }

        // Seller has 20+ successes but 2 losses → GOLD requires ≤1 loss → drops to SILVER
        assertEq(
            uint8(escrow.getUserTier(s)),
            uint8(EscrowTypes.UserTier.SILVER)
        );
    }

    function test_FeeApplied_SilverTier() public {
        address b = makeAddr("silverB");
        address s = makeAddr("silverS");
        // Give seller 5 trades so they're SILVER for the next trade
        _completeTrades(b, s, 5);

        // Now do one more escrow and confirm delivery
        vm.deal(b, ESCROW_AMOUNT + 1 ether);
        vm.prank(b);
        uint256 id = escrow.createEscrow(
            s,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            9000,
            TRADE_DATA_HASH
        );
        vm.prank(b);
        escrow.fund{value: ESCROW_AMOUNT}(id);

        uint256 sellerBefore = s.balance;
        vm.prank(b);
        escrow.confirmDelivery(id);

        uint256 feeAmount = (ESCROW_AMOUNT * 9) / 1000; // SILVER 0.9%
        assertEq(s.balance, sellerBefore + ESCROW_AMOUNT - feeAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Full end-to-end scenario
    // ═══════════════════════════════════════════════════════════════════

    function test_FullFlow_ETH() public {
        // 1. Create
        uint256 id = _createETHEscrow();
        _assertState(id, EscrowTypes.State.DRAFT);

        // 2. Fund
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
        _assertState(id, EscrowTypes.State.FUNDED);

        // 3. Confirm delivery
        vm.prank(buyer);
        escrow.confirmDelivery(id);
        _assertState(id, EscrowTypes.State.RELEASED);
    }

    function test_FullFlow_DisputeEscalateTimeout() public {
        uint256 id = _fundedETHEscrow();

        // Raise dispute
        vm.prank(buyer);
        escrow.raiseDispute(id);
        _assertState(id, EscrowTypes.State.DISPUTED);

        // Primary arbiter silent → escalate
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.prank(seller);
        escrow.escalateToProtocol(id);
        _assertState(id, EscrowTypes.State.ESCALATED);

        // Protocol arbiter also silent → anyone claims timeout
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        vm.warp(txn.disputeDeadline + 1);
        uint256 buyerBefore = buyer.balance;
        escrow.claimTimeout(id);
        _assertState(id, EscrowTypes.State.REFUNDED);
        assertEq(buyer.balance, buyerBefore + ESCROW_AMOUNT);
    }
}
