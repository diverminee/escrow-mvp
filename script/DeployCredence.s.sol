// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {MockOracle} from "../test/mocks/MockOracle.sol";

/// @title Deploy Credence Escrow System
/// @notice Deploys MockOracle + TradeInfraEscrow for local/testnet use
contract DeployCredence is Script {
    function run() external {
        // ── Configuration ──────────────────────────────────────
        // For local Anvil, use the first default account as deployer
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
            ) // Anvil default key #0
        );

        address feeRecipient = vm.envOr(
            "FEE_RECIPIENT",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8) // Anvil default #1
        );

        address protocolArbiter = vm.envOr(
            "PROTOCOL_ARBITER",
            address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC) // Anvil default #2
        );

        // ── Deploy ─────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockOracle (replace with real oracle address on mainnet)
        MockOracle oracle = new MockOracle();
        console.log("MockOracle deployed at:", address(oracle));

        // 2. Deploy TradeInfraEscrow (the main contract)
        TradeInfraEscrow escrow = new TradeInfraEscrow(
            address(oracle),
            feeRecipient,
            protocolArbiter
        );
        console.log("TradeInfraEscrow deployed at:", address(escrow));

        vm.stopBroadcast();

        // ── Verification logs ──────────────────────────────────
        console.log("\n=== Deployment Summary ===");
        console.log("Oracle:           ", address(oracle));
        console.log("Escrow:           ", address(escrow));
        console.log("Fee Recipient:    ", feeRecipient);
        console.log("Protocol Arbiter: ", protocolArbiter);
        console.log("==========================\n");
    }
}
