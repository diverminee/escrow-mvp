// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {DeployCredence} from "../script/DeployCredence.s.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {CentralizedTradeOracle} from "../src/CentralizedTradeOracle.sol";
import {CredenceReceivable} from "../src/CredenceReceivable.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {ITradeOracle} from "../src/interfaces/ITradeOracle.sol";

contract DeployCredenceTest is Test {
    DeployCredence deployer;

    // Anvil defaults used by the script
    address constant ANVIL_DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // key #0 (owner after deploy)
    address constant ANVIL_FEE_RECIPIENT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant ANVIL_PROTOCOL_ARBITER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    function setUp() public {
        deployer = new DeployCredence();
        // Reset env vars to Anvil defaults before each test to prevent cross-test leakage.
        // vm.setEnv changes are NOT rolled back by Foundry's EVM snapshot, so we reset here.
        vm.setEnv("FEE_RECIPIENT", vm.toString(ANVIL_FEE_RECIPIENT));
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(ANVIL_PROTOCOL_ARBITER));
        vm.setEnv("USE_CHAINLINK_ORACLE", "false");
        vm.setEnv("MULTISIG_SIGNERS", "");
        vm.setEnv("DEPLOYMENT_TIER", "TESTNET");
    }

    // ═══════════════════════════════════════════════════════════
    //  Core deployment tests
    // ═══════════════════════════════════════════════════════════

    function test_DeployScript_Runs() public {
        deployer.run();
    }

    function test_DeployScript_DeploysThreeContracts() public {
        deployer.run();

        assertTrue(deployer.deployedOracle().code.length > 0, "Oracle not deployed");
        assertTrue(deployer.deployedEscrow().code.length > 0, "Escrow not deployed");
        assertTrue(deployer.deployedReceivable().code.length > 0, "Receivable not deployed");
    }

    function test_Oracle_IsDeployedAndFunctional() public {
        deployer.run();

        CentralizedTradeOracle oracle = CentralizedTradeOracle(deployer.deployedOracle());

        // Unverified hash returns false by default
        bytes32 testHash = keccak256("test");
        assertFalse(oracle.verifyTradeData(testHash), "Unverified hash should return false");

        // Owner submits verification -> returns true
        vm.prank(oracle.owner());
        oracle.submitVerification(testHash, true);
        assertTrue(oracle.verifyTradeData(testHash), "Verified hash should return true");
    }

    function test_Escrow_HasCorrectOracle() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(address(escrow.oracle()), deployer.deployedOracle(), "Oracle address mismatch");
    }

    function test_Escrow_HasCorrectFeeRecipient() public {
        // Read what the script will use from env (setUp resets to default)
        address expected = vm.envOr("FEE_RECIPIENT", ANVIL_FEE_RECIPIENT);

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.feeRecipient(), expected, "Fee recipient mismatch");
    }

    function test_Escrow_HasCorrectProtocolArbiter() public {
        // Read what the script will use from env (setUp resets to default)
        address expected = vm.envOr("PROTOCOL_ARBITER", ANVIL_PROTOCOL_ARBITER);

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.protocolArbiter(), expected, "Protocol arbiter mismatch");
    }

    function test_Escrow_OwnerIsDeployer() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.owner(), ANVIL_DEPLOYER, "Owner should be deployer");
    }

    function test_Escrow_StartsWithZeroEscrows() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.nextEscrowId(), 0, "Should start with 0 escrows");
    }

    function test_Escrow_ApprovedTokensSeeded() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));

        // ETH (address(0)), USDC, and USDT should be approved
        assertTrue(escrow.approvedTokens(address(0)), "ETH should be approved");
        assertTrue(escrow.approvedTokens(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238), "USDC should be approved");
        assertTrue(escrow.approvedTokens(0x7169D38820dfd117C3FA1f22a697dBA58d90BA06), "USDT should be approved");
    }

    // ═══════════════════════════════════════════════════════════
    //  Receivable NFT deployment tests
    // ═══════════════════════════════════════════════════════════

    function test_Receivable_IsDeployed() public {
        deployer.run();
        assertTrue(deployer.deployedReceivable().code.length > 0, "Receivable NFT not deployed");
    }

    function test_Receivable_RegisteredWithEscrow() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.receivableMinter(), deployer.deployedReceivable(), "Receivable minter not registered");
    }

    function test_Receivable_LinkedToEscrow() public {
        deployer.run();

        CredenceReceivable receivable = CredenceReceivable(deployer.deployedReceivable());
        assertEq(receivable.escrowContract(), deployer.deployedEscrow(), "Receivable not linked to escrow");
    }

    // ═══════════════════════════════════════════════════════════
    //  Deployment tier tests
    // ═══════════════════════════════════════════════════════════

    function test_DefaultTier_IsTestnet() public {
        // Explicitly reset tier in case of env contamination from other tests
        vm.setEnv("DEPLOYMENT_TIER", "TESTNET");

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));

        assertEq(
            uint8(escrow.currentTier()), uint8(EscrowTypes.DeploymentTier.TESTNET), "Default tier should be TESTNET"
        );
        assertEq(escrow.maxEscrowAmount(), type(uint256).max, "TESTNET should have unlimited max");
    }

    function test_DeployWithLaunchTier() public {
        vm.setEnv("DEPLOYMENT_TIER", "LAUNCH");

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));

        assertEq(uint8(escrow.currentTier()), uint8(EscrowTypes.DeploymentTier.LAUNCH), "Tier should be LAUNCH");
        assertEq(escrow.maxEscrowAmount(), escrow.launchLimit(), "Max should be LAUNCH limit");
    }

    // ═══════════════════════════════════════════════════════════
    //  Post-deploy interaction tests
    // ═══════════════════════════════════════════════════════════

    function test_DeployedEscrow_CanCreateEscrow() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));

        address buyer = makeAddr("buyer");
        address seller = makeAddr("seller");
        address arbiter = makeAddr("arbiter");

        // KYC buyer and seller -- escrow owner is the Anvil deployer key
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(buyer, true);
        vm.prank(ANVIL_DEPLOYER);
        escrow.setKYCStatus(seller, true);

        vm.prank(buyer);
        escrow.createEscrow(seller, arbiter, address(0), 1 ether, 1, keccak256("trade-data"));

        assertEq(escrow.nextEscrowId(), 1, "Escrow should have been created");
        assertTrue(escrow.escrowIsValid(0), "Escrow 0 should exist");
    }

    function test_DeployedEscrow_CanFundAndRelease() public {
        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));

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
        escrow.createEscrow(seller, arbiter, address(0), 1 ether, 1, keccak256("data"));

        // Fund
        vm.prank(buyer);
        escrow.fund{value: 1 ether}(0);

        // Confirm delivery (releases to seller)
        uint256 sellerBalBefore = seller.balance;
        vm.prank(buyer);
        escrow.confirmDelivery(0);

        assertTrue(seller.balance > sellerBalBefore, "Seller should have received funds");
    }

    // ═══════════════════════════════════════════════════════════
    //  Environment variable override tests
    // ═══════════════════════════════════════════════════════════

    function test_zOverride_CustomFeeRecipient() public {
        address customFee = makeAddr("customFee");
        vm.setEnv("FEE_RECIPIENT", vm.toString(customFee));

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.feeRecipient(), customFee, "Custom fee recipient not set");
    }

    function test_zOverride_CustomProtocolArbiter() public {
        address customArbiter = makeAddr("customArbiter");
        vm.setEnv("PROTOCOL_ARBITER", vm.toString(customArbiter));

        deployer.run();

        TradeInfraEscrow escrow = TradeInfraEscrow(payable(deployer.deployedEscrow()));
        assertEq(escrow.protocolArbiter(), customArbiter, "Custom arbiter not set");
    }
}
