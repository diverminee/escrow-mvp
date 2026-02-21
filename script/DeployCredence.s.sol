// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {TradeInfraEscrow} from "../src/core/TradeInfraEscrow.sol";
import {CentralizedTradeOracle} from "../src/CentralizedTradeOracle.sol";

/// @title Deploy Credence Escrow System
/// @notice Deploys CentralizedTradeOracle + TradeInfraEscrow, then seeds the
///         recommended token list with ETH, USDC, and USDT.
contract DeployCredence is Script {
    // ── Sepolia testnet token addresses (override via env for other networks) ──
    // Mainnet USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    // Mainnet USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_USDT = 0x7169D38820dfd117C3FA1f22a697dBA58d90BA06;

    function run() external {
        // ── Configuration ──────────────────────────────────────
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
            ) // Anvil default key #0
        );

        address deployerAddress = vm.addr(deployerPrivateKey);

        address feeRecipient = vm.envOr(
            "FEE_RECIPIENT",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8) // Anvil default #1
        );

        address protocolArbiter = vm.envOr(
            "PROTOCOL_ARBITER",
            address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC) // Anvil default #2
        );

        // Oracle owner: the backend EOA that will call submitVerification().
        // Defaults to the deployer for local development.
        address oracleOwner = vm.envOr("ORACLE_OWNER", deployerAddress);

        // Recommended token addresses (default to Sepolia addresses)
        address usdcAddress = vm.envOr("USDC_ADDRESS", SEPOLIA_USDC);
        address usdtAddress = vm.envOr("USDT_ADDRESS", SEPOLIA_USDT);

        // ── Deploy ─────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy CentralizedTradeOracle
        CentralizedTradeOracle oracle = new CentralizedTradeOracle(oracleOwner);
        console.log("CentralizedTradeOracle deployed at:", address(oracle));

        // 2. Deploy TradeInfraEscrow (the main contract)
        //    msg.sender (deployer) becomes owner of the escrow contract
        TradeInfraEscrow escrow = new TradeInfraEscrow(
            address(oracle),
            feeRecipient,
            protocolArbiter
        );
        console.log("TradeInfraEscrow deployed at:", address(escrow));

        // 3. Seed the recommended token list: ETH (address(0)), USDC, USDT
        escrow.addApprovedToken(address(0)); // Native ETH
        escrow.addApprovedToken(usdcAddress);
        escrow.addApprovedToken(usdtAddress);
        console.log("Approved tokens seeded: ETH, USDC, USDT");

        vm.stopBroadcast();

        // ── Verification logs ──────────────────────────────────
        console.log("\n=== Deployment Summary ===");
        console.log("Oracle:            ", address(oracle));
        console.log("Oracle Owner:      ", oracleOwner);
        console.log("Escrow:            ", address(escrow));
        console.log("Escrow Owner:      ", deployerAddress);
        console.log("Fee Recipient:     ", feeRecipient);
        console.log("Protocol Arbiter:  ", protocolArbiter);
        console.log("Approved USDC:     ", usdcAddress);
        console.log("Approved USDT:     ", usdtAddress);
        console.log("==========================\n");
    }
}
