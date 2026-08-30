// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title  ReentrantAttacker
 * @notice Test-only helper contract that attempts a re-entrant call to
 *         `buyCard` inside its `receive()` fallback.
 *
 *         Scenario:
 *           1. Attacker is deployed and given ownership of a listed card.
 *           2. A buyer (victim) calls buyCard on the attacker-owned listing.
 *           3. The marketplace sends ETH to the attacker (seller).
 *           4. Attacker's receive() fires and tries to call buyCard again on
 *              a *second* listed card it controls.
 *           5. The nonReentrant guard on buyCard must revert the second call.
 */
contract ReentrantAttacker is IERC721Receiver {
    // ── State ─────────────────────────────────────────────────────────────
    address public marketplace;
    uint256 public targetTokenId;   // token to attack during re-entrancy
    uint256 public attackPrice;     // price of targetTokenId
    bool    public attackTriggered; // true once receive() has fired
    bool    public attackSucceeded; // true if the re-entrant buyCard worked (bad!)

    // ── Constructor ───────────────────────────────────────────────────────
    constructor(address _marketplace) {
        marketplace = _marketplace;
    }

    // ── IERC721Receiver ───────────────────────────────────────────────────

    /// @dev Required so _safeMint can transfer tokens to this contract.
    function onERC721Received(
        address, address, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ── Setup ─────────────────────────────────────────────────────────────

    /// @notice Store the token we will try to buy re-entrantly.
    function setAttackTarget(uint256 tokenId, uint256 price) external {
        targetTokenId  = tokenId;
        attackPrice    = price;
    }

    // ── Attack surface ────────────────────────────────────────────────────

    /// @notice Called when this contract receives ETH (i.e. when the
    ///         marketplace pays us as a seller). Tries to re-enter buyCard.
    receive() external payable {
        attackTriggered = true;

        if (targetTokenId != 0 && address(this).balance >= attackPrice) {
            // Attempt re-entrant buy – must be blocked by nonReentrant
            (bool ok, ) = marketplace.call{value: attackPrice}(
                abi.encodeWithSignature("buyCard(uint256)", targetTokenId)
            );
            attackSucceeded = ok;
        }
    }

    /// @notice Proxy function so tests can call marketplace functions as
    ///         this contract (e.g. approve, listCard, buyCard).
    function proxyCall(address target, bytes calldata data)
        external
        payable
        returns (bool success, bytes memory result)
    {
        (success, result) = target.call{value: msg.value}(data);
    }

    /// @notice Allow test to fund this contract with ETH.
    function fund() external payable {}

    /// @notice Drain ETH back to test account.
    function drain(address payable to) external {
        to.transfer(address(this).balance);
    }
}