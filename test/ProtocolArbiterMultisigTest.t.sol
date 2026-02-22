// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTestBase} from "./EscrowTestBase.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {ProtocolArbiterMultisig} from "../src/governance/ProtocolArbiterMultisig.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {MockOracle} from "./mocks/MockOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Tests for ProtocolArbiterMultisig
contract ProtocolArbiterMultisigTest is EscrowTestBase {
    ProtocolArbiterMultisig internal multisig;

    address internal signer1 = makeAddr("signer1");
    address internal signer2 = makeAddr("signer2");
    address internal signer3 = makeAddr("signer3");

    uint256 internal constant THRESHOLD = 2;

    function setUp() public override {
        // Deploy escrow with signer1 as temporary protocolArbiter placeholder
        // Then deploy multisig and use it
        oracle = new MockOracle();
        token = new MockERC20("Test Token", "TST");

        // We need to deploy escrow first, then create multisig
        // protocolArb will be replaced by multisig in tests that need it
        // For simplicity, we deploy escrow with a temp protocolArb, then deploy multisig
        address tempArb = makeAddr("tempArb");
        escrow = new TradeInfraEscrow(address(oracle), feeRecipient, tempArb);
        escrow.setKYCStatus(buyer, true);
        escrow.setKYCStatus(seller, true);
        vm.deal(buyer, 100 ether);
        token.mint(buyer, 100_000e18);

        // Deploy multisig — but the escrow's protocolArbiter is immutable, so
        // we need to deploy a fresh escrow with the multisig as protocolArbiter
        // First create the multisig (using a temp escrow addr), then redeploy
        // Actually, let's just deploy the multisig first with address(1) as escrow placeholder,
        // then deploy the real escrow with multisig as protocolArbiter

        // Step 1: Predict multisig address to bootstrap
        // Simpler approach: deploy escrow with multisig as protocolArbiter
        address[] memory signerList = new address[](3);
        signerList[0] = signer1;
        signerList[1] = signer2;
        signerList[2] = signer3;

        // We need escrow address for multisig constructor, but escrow needs multisig as arbiter.
        // Chicken-and-egg: use vm.computeCreateAddress to predict
        // OR: deploy multisig with a dummy escrow, then deploy escrow with multisig as arbiter.
        // The multisig calls escrow.resolveEscalation — so it needs the real escrow address.

        // Solution: deploy the multisig after we know the escrow address
        // Deploy escrow first using a "dummy" protocolArbiter (will be unused in most tests)
        // For integration tests, deploy a second escrow with the multisig

        // Actually, simplest: deploy everything from scratch
        // We compute the multisig address before deploying it
        uint64 nonce = vm.getNonce(address(this));
        address predictedMultisig = vm.computeCreateAddress(address(this), nonce + 1);

        // Deploy escrow with predicted multisig as protocolArbiter
        escrow = new TradeInfraEscrow(address(oracle), feeRecipient, predictedMultisig);

        // Deploy multisig with the real escrow address
        multisig = new ProtocolArbiterMultisig(address(escrow), signerList, THRESHOLD);
        require(address(multisig) == predictedMultisig, "multisig address prediction failed");

        escrow.setKYCStatus(buyer, true);
        escrow.setKYCStatus(seller, true);
        vm.deal(buyer, 100 ether);
        token.mint(buyer, 100_000e18);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════

    function test_Constructor_SetsSigners() public view {
        assertTrue(multisig.isSigner(signer1));
        assertTrue(multisig.isSigner(signer2));
        assertTrue(multisig.isSigner(signer3));
        assertEq(multisig.getSignerCount(), 3);
        assertEq(multisig.threshold(), THRESHOLD);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Cannot resolve with fewer than threshold approvals
    // ═══════════════════════════════════════════════════════════════════

    function test_ProposalNotExecutedBelowThreshold() public {
        uint256 id = _escalatedETHEscrow();

        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        // Only 1 approval — threshold is 2 — should not be executed
        (,, uint256 createdAt, bool executed, uint256 approvalCount,,) = multisig.proposals(proposalId);
        assertFalse(executed);
        assertEq(approvalCount, 1);
        assertTrue(createdAt > 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Resolves correctly when threshold is met
    // ═══════════════════════════════════════════════════════════════════

    function test_ResolvesWhenThresholdMet_Seller() public {
        uint256 id = _escalatedETHEscrow();
        uint256 sellerBefore = seller.balance;

        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        vm.prank(signer2);
        multisig.approveResolution(proposalId);

        // Should have auto-executed — escrow should be in RELEASED state
        _assertState(id, EscrowTypes.State.RELEASED);
        assertTrue(seller.balance > sellerBefore);
    }

    function test_ResolvesWhenThresholdMet_Buyer() public {
        uint256 id = _escalatedETHEscrow();
        uint256 buyerBefore = buyer.balance;

        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 2);

        vm.prank(signer2);
        multisig.approveResolution(proposalId);

        _assertState(id, EscrowTypes.State.REFUNDED);
        assertTrue(buyer.balance > buyerBefore);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Duplicate approval from same signer is rejected
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_DuplicateApproval() public {
        uint256 id = _escalatedETHEscrow();
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        vm.expectRevert(ProtocolArbiterMultisig.AlreadyApproved.selector);
        vm.prank(signer1);
        multisig.approveResolution(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Revocation works before threshold
    // ═══════════════════════════════════════════════════════════════════

    function test_RevokeApproval() public {
        uint256 id = _escalatedETHEscrow();
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        // Revoke
        vm.prank(signer1);
        multisig.revokeApproval(proposalId);

        (,,,, uint256 approvalCount,,) = multisig.proposals(proposalId);
        assertEq(approvalCount, 0);
        assertFalse(multisig.hasApproved(proposalId, signer1));
    }

    function testRevert_RevokeNotApproved() public {
        uint256 id = _escalatedETHEscrow();
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        vm.expectRevert(ProtocolArbiterMultisig.NotApproved.selector);
        vm.prank(signer2);
        multisig.revokeApproval(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Expired proposals cannot be executed
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_ExpiredProposal() public {
        uint256 id = _escalatedETHEscrow();
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        // Warp past proposal expiry
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(ProtocolArbiterMultisig.ProposalExpired.selector);
        vm.prank(signer2);
        multisig.approveResolution(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Access control
    // ═══════════════════════════════════════════════════════════════════

    function testRevert_ProposeNotSigner() public {
        vm.expectRevert(ProtocolArbiterMultisig.NotSigner.selector);
        vm.prank(stranger);
        multisig.proposeResolution(0, 1);
    }

    function testRevert_ApproveNotSigner() public {
        uint256 id = _escalatedETHEscrow();
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        vm.expectRevert(ProtocolArbiterMultisig.NotSigner.selector);
        vm.prank(stranger);
        multisig.approveResolution(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════

    function test_ProposalEmitsEvents() public {
        uint256 id = _escalatedETHEscrow();

        vm.expectEmit(true, true, false, true);
        emit ProtocolArbiterMultisig.ResolutionProposed(0, id, 1, signer1);
        vm.prank(signer1);
        multisig.proposeResolution(id, 1);
    }

    function test_ExecutionEmitsEvent() public {
        uint256 id = _escalatedETHEscrow();

        vm.prank(signer1);
        uint256 proposalId = multisig.proposeResolution(id, 1);

        vm.expectEmit(true, true, false, true);
        emit ProtocolArbiterMultisig.ResolutionExecuted(proposalId, id, 1);
        vm.prank(signer2);
        multisig.approveResolution(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Governance Actions — addSigner / removeSigner via proposal
    // ═══════════════════════════════════════════════════════════════════

    function test_GovernanceAction_AddSigner() public {
        address newSigner = makeAddr("newSigner");

        // Propose addSigner via governance
        bytes memory callData = abi.encodeWithSignature("addSigner(address)", newSigner);
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeGovernanceAction(address(multisig), callData);

        // Approve to meet threshold
        vm.prank(signer2);
        multisig.approveResolution(proposalId);

        // Verify signer was added
        assertTrue(multisig.isSigner(newSigner));
        assertEq(multisig.getSignerCount(), 4);
    }

    function test_GovernanceAction_RemoveSigner() public {
        // First add a 4th signer so we can safely remove one (3 signers, threshold 2)
        address newSigner = makeAddr("newSigner");
        bytes memory addCallData = abi.encodeWithSignature("addSigner(address)", newSigner);
        vm.prank(signer1);
        uint256 addId = multisig.proposeGovernanceAction(address(multisig), addCallData);
        vm.prank(signer2);
        multisig.approveResolution(addId);
        assertEq(multisig.getSignerCount(), 4);

        // Now remove signer3
        bytes memory removeCallData = abi.encodeWithSignature("removeSigner(address)", signer3);
        vm.prank(signer1);
        uint256 removeId = multisig.proposeGovernanceAction(address(multisig), removeCallData);
        vm.prank(signer2);
        multisig.approveResolution(removeId);

        assertFalse(multisig.isSigner(signer3));
        assertEq(multisig.getSignerCount(), 3);
    }

    function testRevert_GovernanceAction_NonSigner() public {
        bytes memory callData = abi.encodeWithSignature("addSigner(address)", makeAddr("x"));
        vm.expectRevert(ProtocolArbiterMultisig.NotSigner.selector);
        vm.prank(stranger);
        multisig.proposeGovernanceAction(address(multisig), callData);
    }

    function testRevert_DirectAddSigner_StillReverts() public {
        vm.expectRevert(ProtocolArbiterMultisig.NotSigner.selector);
        vm.prank(signer1);
        multisig.addSigner(makeAddr("x"));
    }

    function testRevert_DirectRemoveSigner_StillReverts() public {
        vm.expectRevert(ProtocolArbiterMultisig.NotSigner.selector);
        vm.prank(signer1);
        multisig.removeSigner(signer3);
    }

    function test_GovernanceAction_NewSignerCanPropose() public {
        // Add a new signer via governance
        address newSigner = makeAddr("newSigner");
        bytes memory callData = abi.encodeWithSignature("addSigner(address)", newSigner);
        vm.prank(signer1);
        uint256 proposalId = multisig.proposeGovernanceAction(address(multisig), callData);
        vm.prank(signer2);
        multisig.approveResolution(proposalId);

        // New signer can now propose a resolution
        uint256 escrowId = _escalatedETHEscrow();
        vm.prank(newSigner);
        uint256 resId = multisig.proposeResolution(escrowId, 1);

        // Verify proposal was created
        (uint256 eid, uint8 ruling,,,,,) = multisig.proposals(resId);
        assertEq(eid, escrowId);
        assertEq(ruling, 1);
    }
}
