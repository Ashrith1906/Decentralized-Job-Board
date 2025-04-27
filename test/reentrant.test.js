const JobBoard = artifacts.require("JobBoard");
const Attacker = artifacts.require("Attacker");

contract("JobBoard Reentrancy Protection", accounts => {
  const employer = accounts[0];
  const freelancer = accounts[1];
  const attackerOwner = accounts[2];

  let jobBoard, attacker;

  it("should deploy JobBoard and post a job", async () => {
    jobBoard = await JobBoard.new({ from: employer });

    // Post a job with budget of 1 ether
    await jobBoard.postJob("Test Job", web3.utils.toWei("1", "ether"), {
      from: employer,
      value: web3.utils.toWei("1", "ether"),
    });

    // Freelancer applies
    await jobBoard.applyForJob(0, { from: freelancer });

    // Employer selects freelancer
    await jobBoard.selectFreelancer(0, freelancer, { from: employer });
  });

  it("should deploy attacker contract and attempt reentrancy", async () => {
    attacker = await Attacker.new(jobBoard.address, { from: attackerOwner });

    await attacker.setTargetJob(0, { from: attackerOwner });

    // Confirm job is ready
    const jobData = await jobBoard.getJob(0);
    assert.equal(jobData[4].toString(), "1"); // JobStatus.InProgress

    // Try to attack: should fail due to nonReentrant
    try {
      await attacker.attack({ from: attackerOwner });
      assert.fail("Attack should have failed due to reentrancy guard");
    } catch (err) {
      assert(
        err.message.includes("reentrant call") ||
        err.message.includes("revert"),
        "Expected revert on reentrancy"
      );
    }

    // Ensure attacker contract didn’t receive funds
    const attackerBalance = await web3.eth.getBalance(attacker.address);
    assert.equal(attackerBalance, "0", "Attacker should not have received any funds");
  });
});
