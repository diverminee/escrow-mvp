// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";

/// @notice Integration test for complete escrow lifecycle
/// @dev Tests: create → fund → commit documents → confirmDelivery → settle
contract IntegrationEscrowLifecycleTest is EscrowTestBase {

    /// @notice Test complete ETH escrow lifecycle
    function test_CompleteETHEscrowLifecycle() external {
        // ── Step 1: Create Escrow ─────────────────────────────────────────
        uint256 id = _createETHEscrow();
        
        // Verify initial state
        _assertState(id, EscrowTypes.State.DRAFT);
        
        // Verify escrow details
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(txn.buyer, buyer, "buyer should be set");
        assertEq(txn.seller, seller, "seller should be set");
        assertEq(txn.arbiter, arbiter, "arbiter should be set");
        assertEq(txn.amount, ESCROW_AMOUNT, "amount should be set");
        assertEq(txn.token, address(0), "payment token should be ETH");
        
        // ── Step 2: Fund Escrow ───────────────────────────────────────────
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
        
        // Verify funded state
        _assertState(id, EscrowTypes.State.FUNDED);
        
        // Verify balance
        assertEq(address(escrow).balance, ESCROW_AMOUNT, "escrow should hold funds");
        
        // ── Step 3: Commit Documents ─────────────────────────────────────
        _commitDocuments(id);
        
        // Verify documents committed (state unchanged - still Funded)
        _assertState(id, EscrowTypes.State.FUNDED);
        
        // ── Step 4: Confirm Delivery (Buyer releases to seller) ─────────
        // Note: Protocol fee of 1.2% (12 bps) is deducted, so seller receives 98.8%
        uint256 expectedSellerAmount = (ESCROW_AMOUNT * 988) / 1000;
        vm.prank(buyer);
        escrow.confirmDelivery(id);
        
        // Verify released state
        _assertState(id, EscrowTypes.State.RELEASED);
        
        // Verify seller received funds (after 1.2% fee)
        assertEq(seller.balance, expectedSellerAmount, "seller should receive funds (after fee)");
        assertEq(address(escrow).balance, 0, "escrow should be empty");
    }

    /// @notice Test complete ERC20 escrow lifecycle
    function test_CompleteERC20EscrowLifecycle() external {
        // ── Step 1: Create Escrow ─────────────────────────────────────────
        uint256 id = _createERC20Escrow();
        
        // Verify initial state
        _assertState(id, EscrowTypes.State.DRAFT);
        
        // ── Step 2: Fund Escrow ───────────────────────────────────────────
        vm.startPrank(buyer);
        token.approve(address(escrow), ESCROW_AMOUNT);
        escrow.fund(id);
        vm.stopPrank();
        
        // Verify funded state
        _assertState(id, EscrowTypes.State.FUNDED);
        
        // Verify balance
        assertEq(token.balanceOf(address(escrow)), ESCROW_AMOUNT, "escrow should hold tokens");
        
        // ── Step 3: Commit Documents ─────────────────────────────────────
        _commitDocuments(id);
        
        // ── Step 4: Confirm Delivery (Buyer releases to seller) ─────────
        // Note: Protocol fee of 1.2% (12 bps) is deducted, so seller receives 98.8%
        uint256 expectedSellerAmount = (ESCROW_AMOUNT * 988) / 1000;
        vm.prank(buyer);
        escrow.confirmDelivery(id);
        
        // Verify released state
        _assertState(id, EscrowTypes.State.RELEASED);
        
        // Verify seller received funds (after 1.2% fee)
        assertEq(token.balanceOf(seller), expectedSellerAmount, "seller should receive tokens (after fee)");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow should be empty");
    }

    /// @notice Test escrow lifecycle with dispute and resolution (seller wins)
    function test_EscrowLifecycleWithDisputeSellerWins() external {
        // ── Step 1-2: Create and Fund ─────────────────────────────────────
        uint256 id = _fundedETHEscrow();
        
        // ── Step 3: Raise Dispute ─────────────────────────────────────────
        vm.prank(buyer);
        escrow.raiseDispute(id);
        
        // Verify disputed state
        _assertState(id, EscrowTypes.State.DISPUTED);
        
        // ── Step 4: Resolve Dispute (release to seller - ruling 1) ────────
        // Note: Protocol fee of 1.2% (12 bps) is deducted
        uint256 expectedSellerAmount = (ESCROW_AMOUNT * 988) / 1000;
        vm.prank(arbiter);
        escrow.resolveDispute(id, 1); // 1 = release to seller
        
        // Verify resolved state (should be Released)
        _assertState(id, EscrowTypes.State.RELEASED);
        
        // Verify seller received funds (after 1.2% fee)
        assertEq(seller.balance, expectedSellerAmount, "seller should receive funds after dispute resolution");
    }

    /// @notice Test escrow lifecycle with dispute and resolution (buyer wins)
    function test_EscrowLifecycleWithDisputeBuyerWins() external {
        // ── Step 1-2: Create and Fund ─────────────────────────────────────
        uint256 id = _fundedETHEscrow();
        
        // ── Step 3: Raise Dispute ─────────────────────────────────────────
        vm.prank(buyer);
        escrow.raiseDispute(id);
        
        // ── Step 4: Resolve Dispute (refund to buyer - ruling 2) ─────────
        uint256 buyerBalanceBefore = buyer.balance;
        vm.prank(arbiter);
        escrow.resolveDispute(id, 2); // 2 = refund to buyer
        
        // Verify refunded state
        _assertState(id, EscrowTypes.State.REFUNDED);
        
        // Verify funds returned to buyer (no fee on refund)
        assertEq(buyer.balance, buyerBalanceBefore + ESCROW_AMOUNT, "buyer should receive refund");
        assertEq(address(escrow).balance, 0, "escrow should be empty");
    }
}
