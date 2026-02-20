// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ITradeOracle} from "../../src/interfaces/ITradeOracle.sol";

/// @notice Controllable mock oracle for testing
contract MockOracle is ITradeOracle {
    bool public shouldVerify = true;

    function setVerifyResult(bool _result) external {
        shouldVerify = _result;
    }

    function verifyTradeData(
        bytes32 /*tradeDataHash*/
    ) external view returns (bool) {
        return shouldVerify;
    }
}
