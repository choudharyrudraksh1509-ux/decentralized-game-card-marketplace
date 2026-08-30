// test/GameCardMarketplace.test.js
//
// Test suite for GameCardMarketplace using:
//   • Hardhat               – local EVM, contract deployment
//   • @nomicfoundation/hardhat-chai-matchers  (shipped with hardhat-toolbox)
//     This provides the modern replacements for the old Waffle matchers:
//     .to.emit(), .to.be.revertedWith(), .to.changeEtherBalance(), etc.
//   • Chai                  – assertion library
//   • loadFixture           – snapshot-based test isolation (fast resets)
//
// Run:  npx hardhat test
// ─────────────────────────────────────────────────────────────────────────────

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// ── Constants ─────────────────────────────────────────────────────────────────
const TOKEN_URI   = "ipfs://QmExampleGameCardMetadata";
const TOKEN_URI_2 = "ipfs://QmSecondGameCardMetadata";
const PRICE       = ethers.parseEther("0.1");   // 0.1 ETH / MATIC
const ZERO        = 0n;

// ── Shared fixture ────────────────────────────────────────────────────────────
// loadFixture deploys once, then snapshots and restores the chain state
// before every test — much faster than re-deploying on every `beforeEach`.
async function deployFixture() {
  const [owner, buyer, third] = await ethers.getSigners();

  const Factory    = await ethers.getContractFactory("GameCardMarketplace");
  const marketplace = await Factory.deploy(owner.address);
  await marketplace.waitForDeployment();

  const addr = await marketplace.getAddress();
  return { marketplace, addr, owner, buyer, third };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MINTING
// ─────────────────────────────────────────────────────────────────────────────
describe("GameCardMarketplace", function () {

  describe("1 · Minting", function () {

    it("starts nextTokenId at 1", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      expect(await marketplace.nextTokenId()).to.equal(1n);
    });

    it("mints token #1 to the caller (owner signer)", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      expect(await marketplace.ownerOf(1n)).to.equal(owner.address);
    });

    it("mints token #1 to the caller (buyer signer)", async function () {
      const { marketplace, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(buyer).mintCard(TOKEN_URI);
      expect(await marketplace.ownerOf(1n)).to.equal(buyer.address);
    });

    it("sets the tokenURI correctly on mint", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      expect(await marketplace.tokenURI(1n)).to.equal(TOKEN_URI);
    });

    it("increments nextTokenId after every mint", async function () {
      const { marketplace, owner, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      expect(await marketplace.nextTokenId()).to.equal(2n);
      await marketplace.connect(buyer).mintCard(TOKEN_URI_2);
      expect(await marketplace.nextTokenId()).to.equal(3n);
    });

    it("assigns sequential token IDs across different minters", async function () {
      const { marketplace, owner, buyer } = await loadFixture(deployFixture);

      const tx1 = await marketplace.connect(owner).mintCard(TOKEN_URI);
      const rc1 = await tx1.wait();
      const id1 = rc1.logs
        .map(l => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "CardMinted")?.args.tokenId;

      const tx2 = await marketplace.connect(buyer).mintCard(TOKEN_URI_2);
      const rc2 = await tx2.wait();
      const id2 = rc2.logs
        .map(l => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "CardMinted")?.args.tokenId;

      expect(id1).to.equal(1n);
      expect(id2).to.equal(2n);
    });

    it("emits CardMinted with correct args", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await expect(marketplace.connect(owner).mintCard(TOKEN_URI))
        .to.emit(marketplace, "CardMinted")
        .withArgs(1n, owner.address, TOKEN_URI);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. LISTING
  // ─────────────────────────────────────────────────────────────────────────
  describe("2 · Listing", function () {

    // Sub-fixture: owner has minted token #1 and approved the marketplace
    async function listingReadyFixture() {
      const base = await deployFixture();
      const { marketplace, addr, owner } = base;
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      return base;
    }

    it("stores the seller and price in listings mapping", async function () {
      const { marketplace, owner } = await loadFixture(listingReadyFixture);
      await marketplace.connect(owner).listCard(1n, PRICE);
      const [seller, price, isListed] = await marketplace.getListing(1n);
      expect(seller).to.equal(owner.address);
      expect(price).to.equal(PRICE);
      expect(isListed).to.be.true;
    });

    it("emits CardListed with correct args", async function () {
      const { marketplace, owner } = await loadFixture(listingReadyFixture);
      await expect(marketplace.connect(owner).listCard(1n, PRICE))
        .to.emit(marketplace, "CardListed")
        .withArgs(1n, owner.address, PRICE);
    });

    it("allows re-listing at a different price", async function () {
      const { marketplace, owner } = await loadFixture(listingReadyFixture);
      await marketplace.connect(owner).listCard(1n, PRICE);
      const newPrice = ethers.parseEther("0.2");
      await marketplace.connect(owner).listCard(1n, newPrice);
      const [, price] = await marketplace.getListing(1n);
      expect(price).to.equal(newPrice);
    });

    it("reverts when non-owner tries to list", async function () {
      const { marketplace, buyer } = await loadFixture(listingReadyFixture);
      await expect(marketplace.connect(buyer).listCard(1n, PRICE))
        .to.be.revertedWith("GameCard: not token owner");
    });

    it("reverts when price is zero", async function () {
      const { marketplace, owner } = await loadFixture(listingReadyFixture);
      await expect(marketplace.connect(owner).listCard(1n, ZERO))
        .to.be.revertedWith("GameCard: price must be > 0");
    });

    it("reverts when marketplace is not approved for the token", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      // Deliberately skip approval
      await expect(marketplace.connect(owner).listCard(1n, PRICE))
        .to.be.revertedWith("GameCard: marketplace not approved");
    });

    it("accepts approval via setApprovalForAll", async function () {
      const { marketplace, addr, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).setApprovalForAll(addr, true);
      await expect(marketplace.connect(owner).listCard(1n, PRICE))
        .to.emit(marketplace, "CardListed");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CANCEL LISTING
  // ─────────────────────────────────────────────────────────────────────────
  describe("3 · Cancel listing", function () {

    async function listedFixture() {
      const base = await deployFixture();
      const { marketplace, addr, owner } = base;
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      await marketplace.connect(owner).listCard(1n, PRICE);
      return base;
    }

    it("clears the listing after cancellation", async function () {
      const { marketplace, owner } = await loadFixture(listedFixture);
      await marketplace.connect(owner).cancelListing(1n);
      const [, , isListed] = await marketplace.getListing(1n);
      expect(isListed).to.be.false;
    });

    it("emits ListingCancelled with correct args", async function () {
      const { marketplace, owner } = await loadFixture(listedFixture);
      await expect(marketplace.connect(owner).cancelListing(1n))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1n, owner.address);
    });

    it("reverts when non-seller tries to cancel", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(marketplace.connect(buyer).cancelListing(1n))
        .to.be.revertedWith("GameCard: not seller");
    });

    it("reverts when token is not listed at all", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await expect(marketplace.connect(owner).cancelListing(1n))
        .to.be.revertedWith("GameCard: not listed");
    });

    it("reverts on double-cancel", async function () {
      const { marketplace, owner } = await loadFixture(listedFixture);
      await marketplace.connect(owner).cancelListing(1n);
      await expect(marketplace.connect(owner).cancelListing(1n))
        .to.be.revertedWith("GameCard: not listed");
    });

    it("third party (not seller) cannot cancel", async function () {
      const { marketplace, third } = await loadFixture(listedFixture);
      await expect(marketplace.connect(third).cancelListing(1n))
        .to.be.revertedWith("GameCard: not seller");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. BUYING
  // ─────────────────────────────────────────────────────────────────────────
  describe("4 · Buying", function () {

    async function listedFixture() {
      const base = await deployFixture();
      const { marketplace, addr, owner } = base;
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      await marketplace.connect(owner).listCard(1n, PRICE);
      return base;
    }

    it("transfers NFT ownership from seller to buyer", async function () {
      const { marketplace, owner, buyer } = await loadFixture(listedFixture);
      await marketplace.connect(buyer).buyCard(1n, { value: PRICE });
      expect(await marketplace.ownerOf(1n)).to.equal(buyer.address);
    });

    it("sends exact ETH to the seller", async function () {
      const { marketplace, owner, buyer } = await loadFixture(listedFixture);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: PRICE })
      ).to.changeEtherBalance(owner, PRICE);
    });

    it("deducts exact ETH from the buyer", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: PRICE })
      ).to.changeEtherBalance(buyer, -PRICE);
    });

    it("emits CardSale with correct args", async function () {
      const { marketplace, owner, buyer } = await loadFixture(listedFixture);
      await expect(marketplace.connect(buyer).buyCard(1n, { value: PRICE }))
        .to.emit(marketplace, "CardSale")
        .withArgs(1n, owner.address, buyer.address, PRICE);
    });

    it("marks the listing as not-listed after sale", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await marketplace.connect(buyer).buyCard(1n, { value: PRICE });
      const [, , isListed] = await marketplace.getListing(1n);
      expect(isListed).to.be.false;
    });

    it("does not hold ETH in the contract after sale", async function () {
      const { marketplace, addr, buyer } = await loadFixture(listedFixture);
      await marketplace.connect(buyer).buyCard(1n, { value: PRICE });
      expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  describe("5 · Edge cases", function () {

    async function listedFixture() {
      const base = await deployFixture();
      const { marketplace, addr, owner } = base;
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      await marketplace.connect(owner).listCard(1n, PRICE);
      return base;
    }

    // ── 5a. Buy errors ──────────────────────────────────────────────────────
    it("cannot buy an unlisted token (never listed)", async function () {
      const { marketplace, owner, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: PRICE })
      ).to.be.revertedWith("GameCard: not listed");
    });

    it("cannot buy a cancelled listing", async function () {
      const { marketplace, owner, buyer } = await loadFixture(listedFixture);
      await marketplace.connect(owner).cancelListing(1n);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: PRICE })
      ).to.be.revertedWith("GameCard: not listed");
    });

    it("cannot buy an already-sold listing", async function () {
      const { marketplace, buyer, third } = await loadFixture(listedFixture);
      await marketplace.connect(buyer).buyCard(1n, { value: PRICE });
      await expect(
        marketplace.connect(third).buyCard(1n, { value: PRICE })
      ).to.be.revertedWith("GameCard: not listed");
    });

    it("reverts if buyer sends too little ETH", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("GameCard: incorrect payment");
    });

    it("reverts if buyer sends too much ETH", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(
        marketplace.connect(buyer).buyCard(1n, { value: ethers.parseEther("0.2") })
      ).to.be.revertedWith("GameCard: incorrect payment");
    });

    it("reverts if seller tries to buy their own card", async function () {
      const { marketplace, owner } = await loadFixture(listedFixture);
      await expect(
        marketplace.connect(owner).buyCard(1n, { value: PRICE })
      ).to.be.revertedWith("GameCard: seller cannot buy own card");
    });

    // ── 5b. List errors ─────────────────────────────────────────────────────
    it("cannot list with price 0", async function () {
      const { marketplace, addr, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      await expect(marketplace.connect(owner).listCard(1n, 0n))
        .to.be.revertedWith("GameCard: price must be > 0");
    });

    it("non-owner cannot list a token", async function () {
      const { marketplace, addr, owner, buyer } = await loadFixture(deployFixture);
      await marketplace.connect(owner).mintCard(TOKEN_URI);
      await marketplace.connect(owner).approve(addr, 1n);
      await expect(marketplace.connect(buyer).listCard(1n, PRICE))
        .to.be.revertedWith("GameCard: not token owner");
    });

    // ── 5c. Non-owner cancel ────────────────────────────────────────────────
    it("non-owner cannot cancel someone else's listing", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(marketplace.connect(buyer).cancelListing(1n))
        .to.be.revertedWith("GameCard: not seller");
    });

    // ── 5d. Withdraw ────────────────────────────────────────────────────────
    it("withdraw reverts if called by non-owner", async function () {
      const { marketplace, buyer } = await loadFixture(listedFixture);
      await expect(marketplace.connect(buyer).withdraw())
        .to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("withdraw reverts when contract balance is zero", async function () {
      const { marketplace, owner } = await loadFixture(listedFixture);
      await expect(marketplace.connect(owner).withdraw())
        .to.be.revertedWith("GameCard: nothing to withdraw");
    });

    // ── 5e. Re-entrancy protection ──────────────────────────────────────────
    describe("Re-entrancy guard on buyCard", function () {

      it("blocks a malicious seller from re-entering buyCard during ETH transfer", async function () {
        const { marketplace, addr, owner, buyer } = await loadFixture(deployFixture);

        // 1. Deploy the attacker contract (simulates a malicious seller)
        const AttackerFactory = await ethers.getContractFactory("ReentrantAttacker");
        const attacker        = await AttackerFactory.deploy(addr);
        await attacker.waitForDeployment();

        // ── Setup: owner mints & lists card #1 (the re-entrancy target) ──────
        // Mint first so tokenId #1 belongs to owner before attacker mints #2
        await marketplace.connect(owner).mintCard(TOKEN_URI);
        await marketplace.connect(owner).approve(addr, 1n);
        await marketplace.connect(owner).listCard(1n, PRICE);
        const ownerAddr = owner.address;

        // ── Setup: attacker mints card #2 (what it will SELL to trigger ETH) ─
        // Attacker mints via proxy → gets tokenId #2 (nextTokenId was 2)
        const mintData    = marketplace.interface.encodeFunctionData("mintCard", [TOKEN_URI_2]);
        await attacker.proxyCall(addr, mintData);

        const approveData = marketplace.interface.encodeFunctionData("approve", [addr, 2n]);
        await attacker.proxyCall(addr, approveData);

        const listData    = marketplace.interface.encodeFunctionData("listCard", [2n, PRICE]);
        await attacker.proxyCall(addr, listData);

        // ── Attack configuration ──────────────────────────────────────────────
        // When ETH arrives in attacker.receive(), try to buy card #1 re-entrantly
        await attacker.setAttackTarget(1n, PRICE);

        // Fund attacker so it has ETH to attempt the re-entrant buyCard(1) call
        await attacker.fund({ value: PRICE * 2n });

        // ── Execute: buyer purchases attacker's card #2 ───────────────────────
        // ETH flows to attacker.receive() → attacker tries to buyCard(1)
        // nonReentrant on buyCard MUST block the second call
        await marketplace.connect(buyer).buyCard(2n, { value: PRICE });

        // ── Assertions ────────────────────────────────────────────────────────
        // receive() was triggered (we know the attack path ran)
        expect(await attacker.attackTriggered()).to.be.true;
        // the re-entrant buyCard(1) call was rejected by the guard
        expect(await attacker.attackSucceeded()).to.be.false;

        // Card #1 must still be owned by owner (attacker did NOT steal it)
        expect(await marketplace.ownerOf(1n)).to.equal(ownerAddr);

        // Card #1 listing must still be active (not cleared by attacker)
        const [, , isListed] = await marketplace.getListing(1n);
        expect(isListed).to.be.true;
      });
    });
  });
});