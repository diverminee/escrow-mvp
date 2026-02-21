// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Trade Oracle Interface
/// @notice Interface for verifying trade data authenticity
interface ITradeOracle {
    /// @notice Verify trade data authenticity
    /// @param tradeDataHash Hash of trade data
    /// @return bool True if trade data is valid
    function verifyTradeData(bytes32 tradeDataHash) external view returns (bool);
}
