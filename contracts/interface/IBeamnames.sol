// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IBeamnames is IERC721Upgradeable {
    /**
     * @dev Event for withdrew fees
     * @param recipient Address receiving the tokens
     * @param amount Amount of tokens withdrew
     * @param token Token used to withdraw
     */
    event Withdraw(address recipient, uint256 amount, IERC20Upgradeable token);

    /**
     * @dev Event emitted after set a primary name
     * @param owner Address setting the primary name
     * @param tokenId of the primary Beam name
     */
    event NewPrimaryName(address owner, uint256 tokenId);

    /**
     * @dev Event emitted after token used for fees changes
     * @param token new token
     */
    event FeeTokenChanged(IERC20Upgradeable token);

    /**
     * @dev Event emitted after fee amount changes
     * @param fee new fee amount
     */
    event FeeAmountChanged(uint256 fee);

    /**
     * @dev Error emitted is caller is not the owner of a Beam name
     */
    error NotOwner();

    /// @notice Register an Beam name and collects a fee
    /// @param owner of the new Beam name
    /// @param name used for the new Beam name
    /// @return tokenId of the minted NFT
    function register(
        address owner,
        string memory name
    ) external returns (uint256);

    /// @notice Withdraw tokens collected from fees
    /// @dev This function should only be called by the owner of the contract
    /// @param recipient address of the recipient
    /// @return amount withdrew amount
    function withdrawFee(address recipient) external returns (uint256);


    /// @notice Withdraw tokens collected from fees
    /// @dev Should only be called by the owner of the contract
    /// @dev Avoid funds losses after owner changes the primary token
    /// @param recipient address of the recipient
    /// @param _token address of the token to withdraw
    /// @return amount withdrew amount
    function withdrawFeeWithToken(
        address recipient,
        IERC20Upgradeable _token
    ) external returns (uint256);

    /// @notice Total supply of Beam names
    /// @return totalSupply current total supply
    function totalSupply() external view returns (uint256);

    /// @notice Get primary name of an address
    /// @param owner address to lookup their primary name
    /// @return tokenId of the owner primary name
    function primaryNameOf(address owner) external view returns (uint256);

    /// @notice Resolve address by their name
    /// @param name use to resolve
    /// @return address resolved
    function resolve(string memory name) external view returns (address);

    /// @notice Resolve address by namehash
    /// @param namehash use to resolve
    /// @return address resolved
    function resolveByHash(bytes32 namehash) external view returns (address);

    /// @notice Set tokenURI
    /// @param tokenURI new value
    /// @return tokenURI resolved
    function setTokenURI(
        string memory tokenURI
    ) external returns (string memory);

    /// @notice Set token used to collect fees
    /// @param token address of the token
    function setToken(IERC20Upgradeable token) external;

    /// @notice Set fee amount to charge on `token` per registration
    /// @param feeAmount amount of tokens
    function setRegistrationFee(
        uint256 feeAmount
    ) external;

    /// @notice Set a primary name for sender
    /// @param tokenId of the primary name
    function setPrimaryName(uint256 tokenId) external;
}
