const JobBoard = artifacts.require("JobBoard");
const Attacker = artifacts.require("Attacker");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(JobBoard);
  const jobBoardInstance = await JobBoard.deployed();

  // Deploy Attacker with JobBoard address
  await deployer.deploy(Attacker, jobBoardInstance.address);
};
