// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DeployCredence} from "../script/DeployCredence.s.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {CentralizedTradeOracle} from "../src/CentralizedTradeOracle.sol";
import {ITradeOracle} from "../src/interfaces/ITradeOracle.sol";

contract DeployCredenceTest is Test {
    DeployCredence deployer;

    // Anvil defaults used by the script
    address constant ANVIL_DEPLOYER =
        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // key #0 (owner after deploy)
    address constant ANVIL_FEE_RECIPIENT =
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant ANVIL_PROTOCOL_ARBITER =
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    // The deploy script broadcasts 5 transactions:
    //   [0] CentralizedTradeOracle deploy
    //   [1] TradeInfraEscrow deploy
    //   [2] addApprovedToken(address(0))
    //   [3] addApprovedToken(USDC)
    //   [4] addApprovedToken(USDT)
    uint256 constant DEPLOY_TX_COUNT = 5;

    function setUp() public {
        deployer = new DeployCredence();
        // Reset env vars to Anvil defaults before each test to prevent cross-test leakage.
        // vm.setEnv changes are NOT rolled back by Foundry's EVM snapshot, so we reset here.
        vm.setEnv("FEE_RECIPIENT", vm.toString(ANVIL_FEE_RECIPIENT));
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(ANVIL_PROTOCOL_ARBITER));
    }

    // ═══════════════════════════════════════════════════════════
    //  Core deployment tests
    // ═══════════════════════════════════════════════════════════

    function test_DeployScript_Runs() public {
        deployer.run();
    }

    function test_DeployScript_DeploysTwoContracts() public {
        deployer.run();

        address expectedOracle = _getDeployedAddress(0);
        address expectedEscrow = _getDeployedAddress(1);

        assertTrue(expectedOracle.code.length > 0, "Oracle not deployed");
        assertTrue(expectedEscrow.code.length > 0, "Escrow not deployed");
    }

    function test_Oracle_IsDeployedAndFunctional() public {
        deployer.run();

        address oracleAddr = _getDeployedAddress(0);
        CentralizedTradeOracle oracle = CentralizedTradeOracle(oracleAddr);

        // Unverified hash returns false by default
        bytes32 testHash = keccak256("test");
        assertFalse(
            oracle.verifyTradeData(testHash),
            "Unverified hash should return false"
        );

        // Owner submits verification → returns true
        vm.prank(oracle.owner());
        oracle.submitVerification(testHash, true);
        assertTrue(
            oracle.verifyTradeData(testHash),
            "Verified hash should return true"
        );
    }

    function test_Escrow_HasCorrectOracle() public {
        deployer.run();

        address oracleAddr = _getDeployedAddress(0);
        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(
            address(escrow.oracle()),
            oracleAddr,
            "Oracle address mismatch"
        );
    }

    function test_Escrow_HasCorrectFeeRecipient() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(
            escrow.feeRecipient(),
            ANVIL_FEE_RECIPIENT,
            "Fee recipient mismatch"
        );
    }

    function test_Escrow_HasCorrectProtocolArbiter() public {
        // Reset env to default in case another test modified PROTOCOL_ARBITER
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(ANVIL_PROTOCOL_ARBITER));
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(
            escrow.protocolArbiter(),
            ANVIL_PROTOCOL_ARBITER,
            "Protocol arbiter mismatch"
        );
    }

    function test_Escrow_OwnerIsDeployer() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(escrow.owner(), ANVIL_DEPLOYER, "Owner should be deployer");
    }

    function test_Escrow_StartsWithZeroEscrows() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(escrow.nextEscrowId(), 0, "Should start with 0 escrows");
    }

    function test_Escrow_ApprovedTokensSeeded() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        // ETH (address(0)), USDC, and USDT should be approved
        assertTrue(escrow.approvedTokens(address(0)), "ETH should be approved");
        assertTrue(
            escrow.approvedTokens(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238),
            "USDC should be approved"
        );
        assertTrue(
            escrow.approvedTokens(0x7169D38820dfd117C3FA1f22a697dBA58d90BA06),
            "USDT should be approved"
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  Post-deploy interaction tests
    // ═══════════════════════════════════════════════════════════

    function test_DeployedEscrow_CanCreateEscrow() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        address buyer = makeAddr("buyer");
        address seller = makeAddr("seller");
        address arbiter = makeAddr("arbiter");

        // KYC buyer and seller — escrow owner is the Anvil deployer key
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(buyer, true);
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(seller, true);

        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            1 ether,
            1,
            keccak256("trade-data")
        );

        assertEq(escrow.nextEscrowId(), 1, "Escrow should have been created");
        assertTrue(escrow.escrowIsValid(0), "Escrow 0 should exist");
    }

    function test_DeployedEscrow_CanFundAndRelease() public {
        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        address buyer = makeAddr("buyer");
        address seller = makeAddr("seller");
        address arbiter = makeAddr("arbiter");
        vm.deal(buyer, 10 ether);

        // KYC buyer and seller
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(buyer, true);
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(seller, true);

        // Create
        vm.prank(buyer);
        escrow.createEscrow(
            seller,
            arbiter,
            address(0),
            1 ether,
            1,
            keccak256("data")
        );

        // Fund
        vm.prank(buyer);
        escrow.fund{value: 1 ether}(0);

        // Confirm delivery (releases to seller)
        uint256 sellerBalBefore = seller.balance;
        vm.prank(buyer);
        escrow.confirmDelivery(0);

        assertTrue(
            seller.balance > sellerBalBefore,
            "Seller should have received funds"
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  Environment variable override tests
    // ═══════════════════════════════════════════════════════════

    function test_Deploy_WithCustomFeeRecipient() public {
        address customFee = makeAddr("customFee");
        vm.setEnv("FEE_RECIPIENT", vm.toString(customFee));

        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(
            escrow.feeRecipient(),
            customFee,
            "Custom fee recipient not set"
        );

        // Clean up env
        vm.setEnv("FEE_RECIPIENT", vm.toString(ANVIL_FEE_RECIPIENT));
    }

    function test_Deploy_WithCustomProtocolArbiter() public {
        address customArbiter = makeAddr("customArbiter");
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(customArbiter));

        deployer.run();

        address escrowAddr = _getDeployedAddress(1);
        TradeInfraEscrow escrow = TradeInfraEscrow(payable(escrowAddr));

        assertEq(
            escrow.protocolArbiter(),
            customArbiter,
            "Custom arbiter not set"
        );

        // Clean up env
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(ANVIL_PROTOCOL_ARBITER));
    }

    // ═══════════════════════════════════════════════════════════
    //  Helper: compute CREATE-deployed address
    // ═══════════════════════════════════════════════════════════

    /// @dev The deploy script broadcasts from a single sender. Contracts are
    ///      deployed via CREATE, so addresses are deterministic based on
    ///      sender nonce. This helper computes the expected address.
    ///
    ///      The script makes DEPLOY_TX_COUNT broadcast transactions total:
    ///        [0] oracle deploy, [1] escrow deploy, [2-4] addApprovedToken calls.
    ///      nonceOffset=0 → oracle, nonceOffset=1 → escrow.
    function _getDeployedAddress(
        uint256 nonceOffset
    ) internal view returns (address) {
        address scriptSender = ANVIL_DEPLOYER;
        uint256 baseNonce = vm.getNonce(scriptSender);
        uint256 nonce = baseNonce - DEPLOY_TX_COUNT + nonceOffset;
        return _computeCreateAddress(scriptSender, nonce);
    }

    /// @dev Compute CREATE address: keccak256(rlp([sender, nonce]))[12:]
    function _computeCreateAddress(
        address sender,
        uint256 nonce
    ) internal pure returns (address) {
        bytes memory data;
        if (nonce == 0x00) {
            data = abi.encodePacked(
                bytes1(0xd6),
                bytes1(0x94),
                sender,
                bytes1(0x80)
            );
        } else if (nonce <= 0x7f) {
            data = abi.encodePacked(
                bytes1(0xd6),
                bytes1(0x94),
                sender,
                uint8(nonce)
            );
        } else if (nonce <= 0xff) {
            data = abi.encodePacked(
                bytes1(0xd7),
                bytes1(0x94),
                sender,
                bytes1(0x81),
                uint8(nonce)
            );
        } else if (nonce <= 0xffff) {
            data = abi.encodePacked(
                bytes1(0xd8),
                bytes1(0x94),
                sender,
                bytes1(0x82),
                uint16(nonce)
            );
        } else {
            revert("Nonce too large");
        }
        return address(uint160(uint256(keccak256(data))));
    }
}
