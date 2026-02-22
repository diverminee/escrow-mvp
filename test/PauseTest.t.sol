// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {BaseEscrow} from "../src/core/BaseEscrow.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Tests for emergency pause mechanism
contract PauseTest is EscrowTestBase {
    uint256 internal constant DEFAULT_COLLATERAL_BPS = 2000;
    uint256 internal constant BPS_BASE = 10_000;

    // ── Payment Commitment helpers ──────────────────────────────────

    function _collateralAmount() internal pure returns (uint256) {
        return (ESCROW_AMOUNT * DEFAULT_COLLATERAL_BPS) / BPS_BASE;
    }

    function _remainingAmount() internal pure returns (uint256) {
        return ESCROW_AMOUNT - _collateralAmount();
    }

    function _createPCEscrow() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH,
            EscrowTypes.EscrowMode.PAYMENT_COMMITMENT,
            0,
            0
        );
    }

    function _fundedPCEscrow() internal returns (uint256 id) {
        id = _createPCEscrow();
        vm.prank(buyer);
        escrow.fund{value: _collateralAmount()}(id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Unit — Access control
    // ═══════════════════════════════════════════════════════════════════

    function test_Pause_DefaultUnpaused() public view {
        assertFalse(escrow.paused());
    }

    function test_Pause_OwnerCanPause() public {
        escrow.pause();
        assertTrue(escrow.paused());
    }

    function test_Pause_OwnerCanUnpause() public {
        escrow.pause();
        escrow.unpause();
        assertFalse(escrow.paused());
    }

    function testRevert_Pause_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.pause();
    }

    function testRevert_Unpause_NonOwner() public {
        escrow.pause();
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.unpause();
    }

    function testRevert_Pause_WhenAlreadyPaused() public {
        escrow.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.pause();
    }

    function testRevert_Unpause_WhenNotPaused() public {
        vm.expectRevert(Pausable.ExpectedPause.selector);
        escrow.unpause();
    }

    function test_Pause_EmitsPausedEvent() public {
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(address(this));
        escrow.pause();
    }

    function test_Unpause_EmitsUnpausedEvent() public {
        escrow.pause();
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(address(this));
        escrow.unpause();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Unit — Paused blocks capital inflow
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_CreateEscrow6_WhenPaused() public {
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);
    }

    function testRevert_CreateEscrow9_WhenPaused() public {
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH,
            EscrowTypes.EscrowMode.PAYMENT_COMMITMENT,
            0,
            0
        );
    }

    function testRevert_Fund_WhenPaused() public {
        uint256 id = _createETHEscrow();
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    function testRevert_FulfillCommitment_WhenPaused() public {
        uint256 id = _fundedPCEscrow();
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.fulfillCommitment{value: _remainingAmount()}(id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Unit — Unpause restores access
    // ═══════════════════════════════════════════════════════════════════

    function test_CreateEscrow_WorksAfterUnpause() public {
        escrow.pause();
        escrow.unpause();
        vm.prank(buyer);
        uint256 id = escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);
        _assertState(id, EscrowTypes.State.DRAFT);
    }

    function test_Fund_WorksAfterUnpause() public {
        uint256 id = _createETHEscrow();
        escrow.pause();
        escrow.unpause();
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
        _assertState(id, EscrowTypes.State.FUNDED);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Integration — Settlement & disputes work while paused
    // ═══════════════════════════════════════════════════════════════════

    function test_ConfirmDelivery_WorksWhilePaused() public {
        uint256 id = _fundedETHEscrow();
        escrow.pause();
        vm.prank(buyer);
        escrow.confirmDelivery(id);
        _assertState(id, EscrowTypes.State.RELEASED);
    }

    function test_ConfirmByOracle_WorksWhilePaused() public {
        uint256 id = _fundedETHEscrow();
        _commitDocuments(id);
        oracle.setVerifyResult(true);
        escrow.pause();
        escrow.confirmByOracle(id);
        _assertState(id, EscrowTypes.State.RELEASED);
    }

    function test_RaiseDispute_WorksWhilePaused() public {
        uint256 id = _fundedETHEscrow();
        escrow.pause();
        vm.prank(buyer);
        escrow.raiseDispute(id);
        _assertState(id, EscrowTypes.State.DISPUTED);
    }

    function test_ResolveDispute_WorksWhilePaused() public {
        uint256 id = _disputedETHEscrow();
        escrow.pause();
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1);
        _assertState(id, EscrowTypes.State.RELEASED);
    }

    function test_EscalateToProtocol_WorksWhilePaused() public {
        uint256 id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        escrow.pause();
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
        _assertState(id, EscrowTypes.State.ESCALATED);
    }

    function test_ResolveEscalation_WorksWhilePaused() public {
        uint256 id = _escalatedETHEscrow();
        escrow.pause();
        vm.prank(protocolArb);
        escrow.resolveEscalation(id, 2);
        _assertState(id, EscrowTypes.State.REFUNDED);
    }

    function test_ClaimTimeout_WorksWhilePaused() public {
        uint256 id = _escalatedETHEscrow();
        vm.warp(block.timestamp + ESCALATION_TIMELOCK + 1);
        escrow.pause();
        escrow.claimTimeout(id);
        _assertState(id, EscrowTypes.State.REFUNDED);
    }

    function test_CommitDocuments_WorksWhilePaused() public {
        uint256 id = _fundedETHEscrow();
        escrow.pause();
        _commitDocuments(id);
        (,,,, bytes32 merkleRoot,) = escrow.escrowDocuments(id);
        assertTrue(merkleRoot != bytes32(0));
    }

    function test_ClaimDefaultedCommitment_WorksWhilePaused() public {
        uint256 id = _fundedPCEscrow();
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        vm.warp(txn.maturityDate + 1);
        escrow.pause();
        vm.prank(seller);
        escrow.claimDefaultedCommitment(id);
        _assertState(id, EscrowTypes.State.RELEASED);
    }

    function test_AdminFunctions_WorkWhilePaused() public {
        escrow.pause();
        // KYC
        address newUser = makeAddr("newUser");
        escrow.setKYCStatus(newUser, true);
        assertTrue(escrow.kycApproved(newUser));
        // Token allowlist
        escrow.addApprovedToken(address(token));
        assertTrue(escrow.approvedTokens(address(token)));
        // View
        assertEq(escrow.getEscrowCount(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // E2E — Full flow scenarios
    // ═══════════════════════════════════════════════════════════════════

    function test_E2E_PauseMidFlow_ExistingSettles_NewBlocked_UnpauseRestores() public {
        // 1. Create and fund an escrow before pause
        uint256 existingId = _fundedETHEscrow();

        // 2. Pause
        escrow.pause();

        // 3. Existing escrow can settle
        vm.prank(buyer);
        escrow.confirmDelivery(existingId);
        _assertState(existingId, EscrowTypes.State.RELEASED);

        // 4. New escrow creation blocked
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);

        // 5. Unpause restores
        escrow.unpause();
        vm.prank(buyer);
        uint256 newId = escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);
        _assertState(newId, EscrowTypes.State.DRAFT);

        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(newId);
        _assertState(newId, EscrowTypes.State.FUNDED);
    }

    function test_E2E_PauseDuringDispute_ResolutionCompletes() public {
        // 1. Create funded escrow and raise dispute
        uint256 id = _disputedETHEscrow();

        // 2. Pause mid-dispute
        escrow.pause();

        // 3. Arbiter resolves normally
        vm.prank(arbiter);
        escrow.resolveDispute(id, 2); // refund buyer
        _assertState(id, EscrowTypes.State.REFUNDED);

        // 4. Verify buyer received refund
        uint256 buyerBal = buyer.balance;
        assertTrue(buyerBal > 0, "buyer should have received refund");

        // 5. New escrows still blocked
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);
    }
}
