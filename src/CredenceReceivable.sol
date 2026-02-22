// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IReceivableMinter} from "./interfaces/IReceivableMinter.sol";

/// @title CredenceReceivable
/// @notice ERC-721 NFT representing a trade receivable from a PaymentCommitment escrow
/// @dev Only callable by the registered TradeInfraEscrow contract
contract CredenceReceivable is ERC721, IReceivableMinter {
    // ============ Errors ============
    error OnlyEscrow();
    error AlreadySettled();
    error TokenDoesNotExist();
    error SettledReceivableNotTransferable();

    // ============ State Variables ============
    address public immutable escrowContract;
    uint256 private _nextTokenId;

    struct ReceivableData {
        uint256 escrowId;
        uint256 faceValue;
        uint256 maturityDate;
        bytes32 documentMerkleRoot;
        address paymentToken;
        bool isSettled;
    }

    mapping(uint256 => ReceivableData) public receivables;

    // ============ Events ============
    event ReceivableMintedNFT(uint256 indexed tokenId, uint256 indexed escrowId, address indexed seller);
    event ReceivableSettledNFT(uint256 indexed tokenId, uint256 indexed escrowId);

    // ============ Constructor ============
    constructor(address _escrowContract) ERC721("Credence Receivable", "CRCV") {
        escrowContract = _escrowContract;
        _nextTokenId = 1; // Start at 1 so 0 means "not minted"
    }

    // ============ Modifiers ============
    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert OnlyEscrow();
        _;
    }

    // ============ IReceivableMinter ============

    /// @inheritdoc IReceivableMinter
    function mintReceivable(
        uint256 escrowId,
        address seller,
        uint256 faceValue,
        uint256 maturityDate,
        bytes32 documentMerkleRoot,
        address token
    ) external onlyEscrow returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(seller, tokenId);

        receivables[tokenId] = ReceivableData({
            escrowId: escrowId,
            faceValue: faceValue,
            maturityDate: maturityDate,
            documentMerkleRoot: documentMerkleRoot,
            paymentToken: token,
            isSettled: false
        });

        emit ReceivableMintedNFT(tokenId, escrowId, seller);
    }

    /// @inheritdoc IReceivableMinter
    function settleReceivable(uint256 tokenId) external onlyEscrow {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        ReceivableData storage data = receivables[tokenId];
        if (data.isSettled) revert AlreadySettled();

        data.isSettled = true;
        emit ReceivableSettledNFT(tokenId, data.escrowId);
    }

    // ============ Transfer Restrictions ============

    /// @notice Override ERC721 _update to block transfers of settled receivables
    /// @dev Allows minting (from == 0) and burning (to == 0), blocks transfer when settled
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Block transfers (not mints/burns) of settled tokens
        if (receivables[tokenId].isSettled && from != address(0) && to != address(0)) {
            revert SettledReceivableNotTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    // ============ View Functions ============

    /// @notice Get receivable data for a token
    /// @param tokenId The NFT token ID
    /// @return data The receivable data struct
    function getReceivableData(uint256 tokenId) external view returns (ReceivableData memory data) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return receivables[tokenId];
    }

    /// @notice Returns on-chain JSON metadata for the receivable NFT
    /// @param tokenId The NFT token ID
    /// @return string Base64-encoded JSON metadata URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        ReceivableData memory data = receivables[tokenId];

        string memory status = data.isSettled ? "SETTLED" : "ACTIVE";

        string memory json = string(
            abi.encodePacked(
                '{"name":"Credence Receivable #',
                _toString(tokenId),
                '","description":"Trade receivable from Credence escrow #',
                _toString(data.escrowId),
                '","attributes":[{"trait_type":"Face Value","value":"',
                _toString(data.faceValue),
                '"},{"trait_type":"Maturity Date","value":"',
                _toString(data.maturityDate),
                '"},{"trait_type":"Status","value":"',
                status,
                '"},{"trait_type":"Payment Token","value":"',
                _toHexString(data.paymentToken),
                '"},{"trait_type":"Escrow ID","value":"',
                _toString(data.escrowId),
                '"}]}'
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // ============ Internal String Helpers ============

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";
        bytes20 addrBytes = bytes20(addr);
        bytes memory hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            buffer[2 + i * 2] = hexChars[uint8(addrBytes[i]) >> 4];
            buffer[3 + i * 2] = hexChars[uint8(addrBytes[i]) & 0x0f];
        }
        return string(buffer);
    }
}
