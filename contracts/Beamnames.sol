// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Dependencies
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

// Interfaces
import {IBeamnames} from "./interface/IBeamnames.sol";

// Libraries
import {Lib_DNSEncode} from "./lib/Lib_DNSEncode.sol";

// Utils
import {StringUtils} from "./utils/StringUtils.sol";

/**
 * @title Beamnames
 * @dev Beamnames is a NFT contract to resolve names to address as an ENS L2 Resolver contract
 */
contract Beamnames is
    Initializable,
    ERC721Upgradeable,
    OwnableUpgradeable,
    IBeamnames
{
    using StringUtils for string;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /**
     * @dev Base tokenURI
     */
    string private baseTokenURI;

    /**
     * @dev Counter of token IDs
     */
    CountersUpgradeable.Counter private tokenIds;

    /**
     * @dev Top-level-domain for Beam Names
     */
    string public tld;

    /**
     * @dev Amount of tokens charged per registration
     */
    uint256 public registrationFee;

    /**
     * @dev Address of the token used to pay for registrations
     */
    IERC20Upgradeable public token;

    /**
     * @dev Mapping of tokenIDs to name
     */
    mapping(uint256 => string) public nameOf;

    /**
     * @dev Mapping of an address to its primary tokenID which is tied to a Beam name, in the event that the address has multiple tokens
     */
    mapping(address => uint256) public primaryNameOf;

    /**
     * @dev Mapping of dnshashes to address
     */
    mapping(bytes32 => address) public addrByNode;

    /**
     * @dev Mapping of dnshashes to tokenIDs
     */
    mapping(bytes32 => uint256) public tokenIdOf;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20Upgradeable _token,
        uint256 _registrationFee,
        string memory _tld,
        string memory _baseURI
    ) public initializer {
        __Ownable_init();
        __ERC721_init("Beam Names", "BNS");

        tld = _tld;
        token = _token;
        baseTokenURI = _baseURI;
        registrationFee = _registrationFee;

        // token ids staring at 1
        tokenIds.increment();
    }

    /**
     * @inheritdoc IBeamnames
     */
    function register(
        address _subnameOwner,
        string memory _subname
    ) public returns (uint256) {
        // Beam Names are not case-sensible
        require(bytes(_subname).length != 0, "subname cannot be null");
        require(
            _subname.isAlphaNumeric(),
            "name contains unsupported characters or uppercase characters"
        );
        // only owner can register subnames with less than 5 characters
        require(
            _subname.length() > 4 || msg.sender == owner(),
            "invalid subname length"
        );

        // collect registration fee
        _collectRegistrationFee(msg.sender);

        // Add tld to subname
        string memory name = string.concat(_subname, ".");
        name = string.concat(name, tld);

        uint256 tokenId = tokenIds.current();
        tokenIds.increment();

        bytes32 dnshash = bytes32(Lib_DNSEncode.dnsEncodeName(name));

        require(tokenIdOf[dnshash] == 0, "name is already registered");

        nameOf[tokenId] = name;
        tokenIdOf[dnshash] = tokenId;

        // mint a token for the subname owner
        _mint(_subnameOwner, tokenId);

        return tokenId;
    }

    /**
     * @inheritdoc IBeamnames
     */
    function withdrawFee(
        address _recipient
    ) external onlyOwner returns (uint256) {
        return _withdrawFee(_recipient, token);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function withdrawFeeWithToken(
        address _recipient,
        IERC20Upgradeable _token
    ) external onlyOwner returns (uint256) {
        return _withdrawFee(_recipient, _token);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function resolve(string memory _name) external view returns (address) {
        bytes32 namehash = bytes32(Lib_DNSEncode.dnsEncodeName(_name));
        return resolveByHash(namehash);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function resolveByHash(bytes32 _namehash) public view returns (address) {
        uint256 tokenId = tokenIdOf[_namehash];
        if (tokenId == 0) {
            return address(0);
        }
        return ownerOf(tokenId);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function setTokenURI(
        string memory _tokenURI
    ) external onlyOwner returns (string memory) {
        baseTokenURI = _tokenURI;
        return baseTokenURI;
    }

    /**
     * @inheritdoc IBeamnames
     */
    function setToken(IERC20Upgradeable _token) external onlyOwner {
        token = _token;
        emit FeeTokenChanged(token);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function setRegistrationFee(uint256 _feeAmount) external onlyOwner {
        registrationFee = _feeAmount;
        emit FeeAmountChanged(_feeAmount);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function setPrimaryName(uint256 _tokenId) external onlyNameOwner(_tokenId) {
        primaryNameOf[msg.sender] = _tokenId;
        emit NewPrimaryName(msg.sender, _tokenId);
    }

    /**
     * @inheritdoc ERC721Upgradeable
     */
    function tokenURI(
        uint256 _tokenId
    ) public view override returns (string memory) {
        string memory name = nameOf[_tokenId];
        return string.concat(baseTokenURI, name);
    }

    /**
     * @inheritdoc IBeamnames
     */
    function totalSupply() external view returns (uint256) {
        uint256 supply = tokenIds.current() - 1;
        return supply;
    }

    // ==========================
    // PRIVATE FUNCTIONS
    // ==========================

    /**
     * @notice collects the registration fee from the `payer`
     * @param _payer address of the account to charge the registration fee from
     */
    function _collectRegistrationFee(address _payer) private {
        require(
            token.transferFrom(_payer, address(this), registrationFee),
            "Registration fee not paid"
        );
    }

    /**
     * @notice withdraw tokens collected from fees
     * @dev should only be called by the owner of the contract
     * @dev avoid funds losses after owner changes the primary token
     * @param _recipient address of the recipient
     * @param _token address of the token to withdraw
     * @return amount withdrew amount
     */
    function _withdrawFee(
        address _recipient,
        IERC20Upgradeable _token
    ) private returns (uint256) {
        uint256 amount = _token.balanceOf(address(this));
        require(amount > 0, "There is not balance to withdraw");
        require(
            _token.transfer(_recipient, amount),
            "Could not withdraw balance"
        );

        emit Withdraw(_recipient, amount, token);
        return amount;
    }

    /**
     * @notice hook to remove the primary name if a name that has been set as such is transferred
     * @param _from address of the previous name owner
     * @param _firstTokenId tokenId of the name transferred
     */
    function _afterTokenTransfer(
        address _from,
        address to,
        uint256 _firstTokenId,
        uint256 /* batchSize */
    ) internal override {
        bytes32 hash = _dnsEncode(nameOf[_firstTokenId]);

        // Update node address
        addrByNode[hash] = to;

        // Reset primary name after transferring it
        if (primaryNameOf[_from] == _firstTokenId) {
            primaryNameOf[_from] = 0;
            emit NewPrimaryName(msg.sender, 0);
        }
    }

    /**
     * @dev DNS encode a Beam name
     */
    function _dnsEncode(string memory str) private pure returns (bytes32) {
        return bytes32(abi.encode(bytes32(Lib_DNSEncode.dnsEncodeName(str))));
    }

    // ==========================
    // MODIFIERS
    // ==========================

    /**
     * @dev Modifier for checking if the sender is the owner of the Beam Name
     */
    modifier onlyNameOwner(uint256 _tokenId) {
        address owner = ownerOf(_tokenId);
        require(owner == msg.sender, "Not name owner");
        _;
    }
}
