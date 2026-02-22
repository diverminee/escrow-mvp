// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {BaseEscrow} from "../src/core/BaseEscrow.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {HashSpecificMockOracle} from "./mocks/HashSpecificMockOracle.sol";
import {CredenceReceivable} from "../src/CredenceReceivable.sol";

/// @notice Tests for security fixes across the protocol
contract SecurityFixesTest is EscrowTestBase {
    // ═══════════════════════════════════════════════════════════════════
    // Fix 3 — Configurable amount bounds
    // ═══════════════════════════════════════════════════════════════════

    function test_SetMinEscrowAmount_Owner() public {
        uint256 newMin = 1e6; // 1 USDC-sized
        escrow.setMinEscrowAmount(newMin);
        assertEq(escrow.minEscrowAmount(), newMin);
    }

    function testRevert_SetMinEscrowAmount_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.setMinEscrowAmount(1e6);
    }

    function test_SetMinEscrowAmount_EmitsEvent() public {
        uint256 oldMin = escrow.minEscrowAmount();
        uint256 newMin = 1e6;
        vm.expectEmit(false, false, false, true);
        emit BaseEscrow.MinEscrowAmountUpdated(oldMin, newMin);
        escrow.setMinEscrowAmount(newMin);
    }

    function test_SetTierLimits_Owner() public {
        escrow.setTierLimits(50_000e6, 500_000e6, 10_000_000e6);
        assertEq(escrow.launchLimit(), 50_000e6);
        assertEq(escrow.growthLimit(), 500_000e6);
        assertEq(escrow.matureLimit(), 10_000_000e6);
    }

    function testRevert_SetTierLimits_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.setTierLimits(1, 2, 3);
    }

    function testRevert_SetTierLimits_InvalidOrder_LaunchGtGrowth() public {
        vm.expectRevert(BaseEscrow.InvalidTierLimits.selector);
        escrow.setTierLimits(100, 50, 200);
    }

    function testRevert_SetTierLimits_InvalidOrder_GrowthGtMature() public {
        vm.expectRevert(BaseEscrow.InvalidTierLimits.selector);
        escrow.setTierLimits(50, 200, 100);
    }

    function test_SetTierLimits_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit BaseEscrow.TierLimitsUpdated(50_000e6, 500_000e6, 10_000_000e6);
        escrow.setTierLimits(50_000e6, 500_000e6, 10_000_000e6);
    }

    function test_CreateEscrow_RespectsNewMinAmount() public {
        // Set a higher min
        escrow.setMinEscrowAmount(2e18);

        // 1 ETH is now below minimum
        vm.prank(buyer);
        vm.expectRevert(BaseEscrow.AmountBelowMinimum.selector);
        escrow.createEscrow(seller, arbiter, address(0), 1e18, TRADE_ID, TRADE_DATA_HASH);

        // 2 ETH works
        vm.prank(buyer);
        uint256 id = escrow.createEscrow(seller, arbiter, address(0), 2e18, TRADE_ID, TRADE_DATA_HASH);
        assertTrue(escrow.escrowIsValid(id));
    }

    function test_TierCeiling_RespectsNewLimits() public {
        // Set USDC-scale limits
        escrow.setTierLimits(50_000e6, 500_000e6, 10_000_000e6);

        // Upgrade to LAUNCH
        escrow.upgradeTier(EscrowTypes.DeploymentTier.LAUNCH);
        assertEq(escrow.maxEscrowAmount(), 50_000e6);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Fix 4 — feeRecipient and protocolArbiter setters
    // ═══════════════════════════════════════════════════════════════════

    function test_SetFeeRecipient_Owner() public {
        address newRecipient = makeAddr("newFeeRecipient");
        escrow.setFeeRecipient(newRecipient);
        assertEq(escrow.feeRecipient(), newRecipient);
    }

    function testRevert_SetFeeRecipient_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.setFeeRecipient(makeAddr("x"));
    }

    function testRevert_SetFeeRecipient_ZeroAddress() public {
        vm.expectRevert(BaseEscrow.ZeroAddress.selector);
        escrow.setFeeRecipient(address(0));
    }

    function testRevert_SetFeeRecipient_SameAsArbiter() public {
        vm.expectRevert(BaseEscrow.FeeRecipientCannotBeArbiter.selector);
        escrow.setFeeRecipient(protocolArb);
    }

    function test_SetFeeRecipient_EmitsEvent() public {
        address newRecipient = makeAddr("newFeeRecipient");
        vm.expectEmit(true, true, false, false);
        emit BaseEscrow.FeeRecipientUpdated(feeRecipient, newRecipient);
        escrow.setFeeRecipient(newRecipient);
    }

    function test_SetProtocolArbiter_Owner() public {
        address newArbiter = makeAddr("newProtocolArbiter");
        escrow.setProtocolArbiter(newArbiter);
        assertEq(escrow.protocolArbiter(), newArbiter);
    }

    function testRevert_SetProtocolArbiter_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(BaseEscrow.NotOwner.selector);
        escrow.setProtocolArbiter(makeAddr("x"));
    }

    function testRevert_SetProtocolArbiter_ZeroAddress() public {
        vm.expectRevert(BaseEscrow.ZeroAddress.selector);
        escrow.setProtocolArbiter(address(0));
    }

    function testRevert_SetProtocolArbiter_SameAsFeeRecipient() public {
        vm.expectRevert(BaseEscrow.FeeRecipientCannotBeArbiter.selector);
        escrow.setProtocolArbiter(feeRecipient);
    }

    function test_SetProtocolArbiter_EmitsEvent() public {
        address newArbiter = makeAddr("newProtocolArbiter");
        vm.expectEmit(true, true, false, false);
        emit BaseEscrow.ProtocolArbiterUpdated(protocolArb, newArbiter);
        escrow.setProtocolArbiter(newArbiter);
    }

    function test_ResolveEscalation_WithUpdatedArbiter() public {
        // Create and escalate an escrow
        uint256 id = _escalatedETHEscrow();

        // Change protocol arbiter
        address newArbiter = makeAddr("newProtocolArbiter");
        escrow.setProtocolArbiter(newArbiter);

        // New arbiter can resolve
        vm.prank(newArbiter);
        escrow.resolveEscalation(id, 2);
        _assertState(id, EscrowTypes.State.REFUNDED);
    }
}

/// @notice Tests for Fix 5 — Oracle verifies merkle root instead of tradeDataHash
contract OracleMerkleRootTest is Test {
    TradeInfraEscrow internal escrow;
    HashSpecificMockOracle internal hsOracle;

    address internal buyer = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal arbiter = makeAddr("arbiter");
    address internal protocolArb = makeAddr("protocolArbiter");
    address internal feeRecip = makeAddr("feeRecipient");

    uint256 internal constant ESCROW_AMOUNT = 1e18;
    bytes32 internal constant TRADE_DATA_HASH = keccak256("trade-data");
    uint256 internal constant TRADE_ID = 42;

    bytes32 internal constant INVOICE_HASH = keccak256("invoice");
    bytes32 internal constant BOL_HASH = keccak256("bill-of-lading");
    bytes32 internal constant PACKING_HASH = keccak256("packing-list");
    bytes32 internal constant COO_HASH = keccak256("certificate-of-origin");

    function setUp() public {
        hsOracle = new HashSpecificMockOracle();
        escrow = new TradeInfraEscrow(address(hsOracle), feeRecip, protocolArb);
        escrow.setKYCStatus(buyer, true);
        escrow.setKYCStatus(seller, true);
        vm.deal(buyer, 100 ether);
    }

    function _fundedEscrow() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow(seller, arbiter, address(0), ESCROW_AMOUNT, TRADE_ID, TRADE_DATA_HASH);
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    function _merkleRoot() internal pure returns (bytes32) {
        // Reproduce BaseEscrow._computeMerkleRoot for 4 leaves
        bytes32 left = keccak256(abi.encodePacked(INVOICE_HASH, BOL_HASH));
        bytes32 right = keccak256(abi.encodePacked(PACKING_HASH, COO_HASH));
        return keccak256(abi.encodePacked(left, right));
    }

    function test_ConfirmByOracle_VerifiesMerkleRoot() public {
        uint256 id = _fundedEscrow();

        // Commit documents
        vm.prank(seller);
        escrow.commitDocuments(id, INVOICE_HASH, BOL_HASH, PACKING_HASH, COO_HASH);

        // Set oracle to verify merkle root (NOT tradeDataHash)
        hsOracle.setVerifiedHash(_merkleRoot());

        // Should succeed because oracle now verifies merkle root
        escrow.confirmByOracle(id);

        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(uint8(txn.state), uint8(EscrowTypes.State.RELEASED));
    }

    function testRevert_ConfirmByOracle_WhenOracleOnlyVerifiesTradeDataHash() public {
        uint256 id = _fundedEscrow();

        // Commit documents
        vm.prank(seller);
        escrow.commitDocuments(id, INVOICE_HASH, BOL_HASH, PACKING_HASH, COO_HASH);

        // Set oracle to verify tradeDataHash (old buggy behavior would pass, fixed behavior should fail)
        hsOracle.setVerifiedHash(TRADE_DATA_HASH);

        // Should revert because oracle is checking for tradeDataHash but contract now sends merkleRoot
        vm.expectRevert(TradeInfraEscrow.OracleVerificationFailed.selector);
        escrow.confirmByOracle(id);
    }
}

/// @notice Tests for Fix 7 — Settled receivable NFTs cannot be transferred
contract SettledNFTTransferTest is EscrowTestBase {
    CredenceReceivable internal receivable;

    function setUp() public override {
        super.setUp();
        receivable = new CredenceReceivable(address(escrow));
        escrow.setReceivableMinter(address(receivable));
    }

    function _mintReceivable() internal returns (uint256 escrowId, uint256 tokenId) {
        // Create a PAYMENT_COMMITMENT escrow, fund, commit docs → NFT minted
        vm.prank(buyer);
        escrowId = escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH,
            EscrowTypes.EscrowMode.PAYMENT_COMMITMENT,
            60,
            2000
        );
        uint256 collateral = (ESCROW_AMOUNT * 2000) / 10_000;
        vm.prank(buyer);
        escrow.fund{value: collateral}(escrowId);
        _commitDocuments(escrowId);
        tokenId = escrow.getReceivableTokenId(escrowId);
    }

    function test_Transfer_ActiveReceivable() public {
        (, uint256 tokenId) = _mintReceivable();
        address recipient = makeAddr("recipient");

        // Seller can transfer an active (unsettled) receivable
        vm.prank(seller);
        receivable.transferFrom(seller, recipient, tokenId);
        assertEq(receivable.ownerOf(tokenId), recipient);
    }

    function testRevert_Transfer_SettledReceivable() public {
        (uint256 escrowId, uint256 tokenId) = _mintReceivable();

        // Settle via confirmDelivery
        oracle.setVerifyResult(true);
        vm.prank(buyer);
        escrow.confirmDelivery(escrowId);

        // Now transfer should revert
        vm.prank(seller);
        vm.expectRevert(CredenceReceivable.SettledReceivableNotTransferable.selector);
        receivable.transferFrom(seller, makeAddr("recipient"), tokenId);
    }

    function testRevert_ApprovedTransfer_SettledReceivable() public {
        (uint256 escrowId, uint256 tokenId) = _mintReceivable();
        address operator = makeAddr("operator");

        // Approve operator before settlement
        vm.prank(seller);
        receivable.approve(operator, tokenId);

        // Settle
        oracle.setVerifyResult(true);
        vm.prank(buyer);
        escrow.confirmDelivery(escrowId);

        // Approved operator also cannot transfer settled token
        vm.prank(operator);
        vm.expectRevert(CredenceReceivable.SettledReceivableNotTransferable.selector);
        receivable.transferFrom(seller, makeAddr("recipient"), tokenId);
    }

    function test_Mint_StillWorksAfterSettlement() public {
        // Mint and settle one receivable
        (uint256 escrowId1,) = _mintReceivable();
        oracle.setVerifyResult(true);
        vm.prank(buyer);
        escrow.confirmDelivery(escrowId1);

        // Mint a second one — should work fine
        vm.prank(buyer);
        uint256 escrowId2 = escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID + 1,
            keccak256("trade-data-2"),
            EscrowTypes.EscrowMode.PAYMENT_COMMITMENT,
            60,
            2000
        );
        uint256 collateral = (ESCROW_AMOUNT * 2000) / 10_000;
        vm.prank(buyer);
        escrow.fund{value: collateral}(escrowId2);
        _commitDocuments(escrowId2);

        uint256 tokenId2 = escrow.getReceivableTokenId(escrowId2);
        assertTrue(tokenId2 != 0, "second receivable should be minted");
        assertEq(receivable.ownerOf(tokenId2), seller);
    }
}
