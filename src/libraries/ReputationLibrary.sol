// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowTypes} from "./EscrowTypes.sol";

/// @title Reputation Library
/// @notice Pure functions for reputation tier calculations
library ReputationLibrary {
    /// @notice Calculate user's tier based on trade history
    /// @param successes Number of successful trades completed
    /// @param losses Number of disputes lost
    /// @return UserTier Current tier of the user
    function getUserTier(uint256 successes, uint256 losses) internal pure returns (EscrowTypes.UserTier) {
        // DIAMOND: 50+ successful trades, 0 losses
        if (successes >= 50 && losses == 0) return EscrowTypes.UserTier.DIAMOND;

        // GOLD: 20+ successful trades, ≤1 loss
        if (successes >= 20 && losses <= 1) return EscrowTypes.UserTier.GOLD;

        // SILVER: 5+ successful trades
        if (successes >= 5) return EscrowTypes.UserTier.SILVER;

        // BRONZE: New user or low activity
        return EscrowTypes.UserTier.BRONZE;
    }

    /// @notice Get fee rate for a given tier
    /// @param tier User's reputation tier
    /// @return Fee in basis points divided by 1000 (e.g., 12 = 1.2%)
    function getFeeRate(EscrowTypes.UserTier tier) internal pure returns (uint256) {
        // DIAMOND: 0.7% fee
        if (tier == EscrowTypes.UserTier.DIAMOND) return 7;

        // GOLD: 0.8% fee
        if (tier == EscrowTypes.UserTier.GOLD) return 8;

        // SILVER: 0.9% fee
        if (tier == EscrowTypes.UserTier.SILVER) return 9;

        // BRONZE: 1.2% fee (default, higher for risk)
        return 12;
    }

    /// @notice Calculate exact fee amount for transaction
    /// @param amount Transaction amount
    /// @param tier User's tier
    /// @return Calculated fee amount
    function calculateFee(uint256 amount, EscrowTypes.UserTier tier) internal pure returns (uint256) {
        uint256 feeRate = getFeeRate(tier);
        return (amount * feeRate) / 1000;
    }
}
