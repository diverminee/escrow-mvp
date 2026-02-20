// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {MockOracle} from "./mocks/MockOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Shared setup for all escrow test contracts
abstract contract EscrowTestBase is Test {
    TradeInfraEscrow internal escrow;
    MockOracle internal oracle;
    MockERC20 internal token;

    // Named actors
    address internal buyer = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal arbiter = makeAddr("arbiter");
    address internal protocolArb = makeAddr("protocolArbiter");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant ESCROW_AMOUNT = 1e18; // 1 ETH / 1 token unit (keeps ETH tests within vm.deal budget)
    bytes32 internal constant TRADE_DATA_HASH = keccak256("trade-data");
    uint256 internal constant TRADE_ID = 42;

    // ── Timeouts (mirrors contract constants) ──────────────────────────────
    uint256 internal constant DISPUTE_TIMELOCK = 14 days;
    uint256 internal constant ESCALATION_TIMELOCK = 7 days;

    function setUp() public virtual {
        oracle = new MockOracle();
        token = new MockERC20("Test Token", "TST");
        escrow = new TradeInfraEscrow(
            address(oracle),
            feeRecipient,
            protocolArb
        );

        // Give buyer ETH and tokens
        vm.deal(buyer, 100 ether);
        token.mint(buyer, 100_000e18);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /// Create an ETH escrow and return its id (DRAFT state)
    function _createETHEscrow() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    /// Create an ERC20 escrow and return its id (DRAFT state)
    function _createERC20Escrow() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createEscrow(
            seller,
            arbiter,
            address(token),
            ESCROW_AMOUNT,
            TRADE_ID,
            TRADE_DATA_HASH
        );
    }

    /// Create and fund an ETH escrow (FUNDED state)
    function _fundedETHEscrow() internal returns (uint256 id) {
        id = _createETHEscrow();
        vm.prank(buyer);
        escrow.fund{value: ESCROW_AMOUNT}(id);
    }

    /// Create and fund an ERC20 escrow (FUNDED state)
    function _fundedERC20Escrow() internal returns (uint256 id) {
        id = _createERC20Escrow();
        vm.startPrank(buyer);
        token.approve(address(escrow), ESCROW_AMOUNT);
        escrow.fund(id);
        vm.stopPrank();
    }

    /// Create, fund, and raise dispute on an ETH escrow (DISPUTED state)
    function _disputedETHEscrow() internal returns (uint256 id) {
        id = _fundedETHEscrow();
        vm.prank(buyer);
        escrow.raiseDispute(id);
    }

    /// Create, fund, dispute, and escalate (ESCALATED state)
    function _escalatedETHEscrow() internal returns (uint256 id) {
        id = _disputedETHEscrow();
        vm.warp(block.timestamp + DISPUTE_TIMELOCK + 1);
        vm.prank(buyer);
        escrow.escalateToProtocol(id);
    }

    /// Convenience: assert escrow state
    function _assertState(
        uint256 id,
        EscrowTypes.State expected
    ) internal view {
        EscrowTypes.EscrowTransaction memory txn = escrow.getEscrow(id);
        assertEq(uint8(txn.state), uint8(expected), "unexpected escrow state");
    }
}
