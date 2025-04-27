const JobBoard = artifacts.require("JobBoard");

contract("JobBoard", (accounts) => {
  const employer = accounts[0];
  const freelancer1 = accounts[1];
  const freelancer2 = accounts[2];
  const outsider = accounts[3];

  let jobId;

  it("should allow employer to post a job", async () => {
    const jobBoard = await JobBoard.deployed();
    const budget = web3.utils.toWei("1", "ether");

    const tx = await jobBoard.postJob("Frontend Dev", budget, { from: employer, value: budget });

    const job = await jobBoard.getJob(0);
    assert.equal(job[0], "Frontend Dev");
    assert.equal(job[1].toString(), budget);
    jobId = 0;
  });

  it("should allow freelancers to apply for job", async () => {
    const jobBoard = await JobBoard.deployed();

    await jobBoard.applyForJob(jobId, { from: freelancer1 });
    await jobBoard.applyForJob(jobId, { from: freelancer2 });

    const applicants = await jobBoard.getApplicants(jobId, { from: employer });
    assert.include(applicants, freelancer1);
    assert.include(applicants, freelancer2);
  });

  it("should prevent employer from applying to their own job", async () => {
    const jobBoard = await JobBoard.deployed();

    try {
      await jobBoard.applyForJob(jobId, { from: employer });
      assert.fail("Employer should not be able to apply to own job");
    } catch (err) {
      assert.include(err.message, "Employer cannot apply to own job");
    }
  });

  it("should allow employer to select a freelancer", async () => {
    const jobBoard = await JobBoard.deployed();
    const tx = await jobBoard.selectFreelancer(jobId, freelancer1, { from: employer });

    const job = await jobBoard.getJob(jobId);
    assert.equal(job[3], freelancer1);
    assert.equal(job[4].toString(), "1"); // JobStatus.InProgress
  });

  it("should not allow outsider to select freelancer", async () => {
    const jobBoard = await JobBoard.deployed();

    try {
      await jobBoard.selectFreelancer(jobId, freelancer2, { from: outsider });
      assert.fail("Outsider shouldn't be able to select freelancer");
    } catch (err) {
      assert.include(err.message, "Only employer can call this");
    }
  });

  it("should release payment and mark job as completed", async () => {
    const jobBoard = await JobBoard.deployed();
    const initialBalance = web3.utils.toBN(await web3.eth.getBalance(freelancer1));

    const tx = await jobBoard.releasePayment(jobId, { from: employer });

    const finalBalance = web3.utils.toBN(await web3.eth.getBalance(freelancer1));
    assert(finalBalance.sub(initialBalance).gt(web3.utils.toBN(0)), "Freelancer didn't receive payment");

    const job = await jobBoard.getJob(jobId);
    assert.equal(job[4].toString(), "2"); // JobStatus.Completed
  });

  it("should not allow double payment", async () => {
    const jobBoard = await JobBoard.deployed();

    try {
      await jobBoard.releasePayment(jobId, { from: employer });
      assert.fail("Payment was released twice");
    } catch (err) {
      assert.include(err.message, "Insufficient funds");
    }
  });

  it("should allow only authorized users to send messages", async () => {
    const jobBoard = await JobBoard.deployed();
    await jobBoard.sendMessageRef(jobId, employer, "Qm123abc", { from: freelancer1 });

    try {
      await jobBoard.sendMessageRef(jobId, employer, "QmFakeCID", { from: outsider });
      assert.fail("Unauthorized message sent");
    } catch (err) {
      assert.include(err.message, "Not authorized to send messages");
    }

    const messages = await jobBoard.getMessageRefs(jobId, employer, { from: freelancer1 });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ipfsCid, "Qm123abc");
  });
});