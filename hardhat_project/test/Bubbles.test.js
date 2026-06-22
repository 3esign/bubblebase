const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bubbles", function () {
  let bubbles;
  let owner, player1, player2;
  const ACTION_FEE = ethers.parseEther("0.00001");
  const CREATOR_ADDRESS = "0x525eE261f2E22E14a10C699A9A11BB521Bd8a2C5";

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();
    const BubblesFactory = await ethers.getContractFactory("Bubbles");
    bubbles = await BubblesFactory.deploy();
    await bubbles.waitForDeployment();
  });

  it("should pack coordinates correctly", async function () {
    const packed = await bubbles.encodeCoordinate(5, -10);
    expect(packed.toString()).to.equal(BigInt("0x00000005FFFFFFF6").toString());
  });

  it("should allow placing a node and pay the creator fee", async function () {
    const creatorInitialBalance = await ethers.provider.getBalance(CREATOR_ADDRESS);
    const packed = await bubbles.encodeCoordinate(10, 20);

    await expect(bubbles.connect(player1).placeNode(10, 20, { value: ACTION_FEE }))
      .to.emit(bubbles, "NodePlaced")
      .withArgs(packed, player1.address, 10, 20);

    const creatorFinalBalance = await ethers.provider.getBalance(CREATOR_ADDRESS);
    const expectedCreatorFee = (ACTION_FEE * 5n) / 100n;
    expect(creatorFinalBalance - creatorInitialBalance).to.equal(expectedCreatorFee);
  });

  it("should allow requesting, approving, decay, nurturing and boosting a connection", async function () {
    await bubbles.connect(player1).placeNode(1, 1, { value: ACTION_FEE });
    await bubbles.connect(player2).placeNode(2, 2, { value: ACTION_FEE });

    const node1 = await bubbles.encodeCoordinate(1, 1);
    const node2 = await bubbles.encodeCoordinate(2, 2);

    const fee = await bubbles.calculateConnectionFee(node1, node2);
    // 0.00001 base + 2 * 0.000001 distance = 0.000012 ether
    expect(fee).to.equal(ethers.parseEther("0.000012"));

    await expect(bubbles.connect(player1).requestConnection(node1, node2, { value: fee }))
      .to.emit(bubbles, "ConnectionRequested");

    await expect(bubbles.connect(player2).approveConnection(node1, node2))
      .to.emit(bubbles, "ConnectionApproved");

    // Connection should start active
    expect(await bubbles.isConnectionActive(node1, node2)).to.be.true;

    // Get connection data
    const key = await bubbles.getConnKey(node1, node2);
    let conn = await bubbles.connections(key);
    expect(conn.boostMultiplier).to.equal(100n); // 1.0x

    // 1. Advance time by 25 hours (decay threshold is 24 hours)
    await ethers.provider.send("evm_increaseTime", [25 * 3600]);
    await ethers.provider.send("evm_mine");

    // Connection should now be decayed (inactive)
    expect(await bubbles.isConnectionActive(node1, node2)).to.be.false;

    // 2. Nurture the connection to restore activity
    const nurtureFee = await bubbles.calculateNurtureFee(node1, node2);
    await expect(bubbles.connect(player1).nurtureConnection(node1, node2, { value: nurtureFee }))
      .to.emit(bubbles, "ConnectionNurtured");

    expect(await bubbles.isConnectionActive(node1, node2)).to.be.true;

    // 3. Boost the connection to increase multiplier
    const boostFee = await bubbles.calculateBoostFee(node1, node2);
    const tx = await bubbles.connect(player1).boostConnection(node1, node2, { value: boostFee });
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);

    await expect(tx)
      .to.emit(bubbles, "ConnectionBoosted")
      .withArgs(node1, node2, 150n, block.timestamp);

    conn = await bubbles.connections(key);
    expect(conn.boostMultiplier).to.equal(150n); // 1.5x
  });
});
