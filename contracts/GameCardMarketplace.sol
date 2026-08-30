// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  GameCardMarketplace
 * @notice ERC-721 NFT marketplace for digital game cards.
 */
contract GameCardMarketplace is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Ownable,
    ReentrancyGuard
{
    uint256 public nextTokenId = 1;

    struct Listing {
        address seller;
        uint256 price;
        bool    isListed;
    }

    mapping(uint256 => Listing) public listings;

    event CardMinted(uint256 indexed tokenId, address indexed owner, string tokenURI);
    event CardListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event CardSale(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);

    constructor(address initialOwner)
        ERC721("GameCard", "GCARD")
        Ownable(initialOwner)
    {}

    function mintCard(string memory uri) external returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        emit CardMinted(tokenId, msg.sender, uri);
    }

    function listCard(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "GameCard: not token owner");
        require(price > 0, "GameCard: price must be > 0");
        require(
            getApproved(tokenId) == address(this) ||
            isApprovedForAll(msg.sender, address(this)),
            "GameCard: marketplace not approved"
        );
        listings[tokenId] = Listing({ seller: msg.sender, price: price, isListed: true });
        emit CardListed(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.isListed, "GameCard: not listed");
        require(listing.seller == msg.sender, "GameCard: not seller");
        listing.isListed = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    function buyCard(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isListed, "GameCard: not listed");
        require(msg.value == listing.price, "GameCard: incorrect payment");
        require(listing.seller != msg.sender, "GameCard: seller cannot buy own card");

        address seller = listing.seller;
        uint256 price  = listing.price;
        listing.isListed = false;

        _transfer(seller, msg.sender, tokenId);

        (bool sent, ) = payable(seller).call{value: price}("");
        require(sent, "GameCard: ETH transfer failed");

        emit CardSale(tokenId, seller, msg.sender, price);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "GameCard: nothing to withdraw");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "GameCard: withdraw failed");
    }

    function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool isListed) {
        Listing storage l = listings[tokenId];
        return (l.seller, l.price, l.isListed);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Required Overrides
    // ────────────────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}