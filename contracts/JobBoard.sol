pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract JobBoard is ReentrancyGuard {
    enum JobStatus { Open, InProgress, Completed }

    struct Job {
        uint256 jobId;
        string title;
        uint256 budget;
        address employer;
        address payable freelancer;
        bool isTaken;
        bool isCompleted;
        bool isPaid;
        JobStatus status;
        address[] applicants;
    }

    // === Modified for IPFS Messaging ===
    struct MessageRef {
        address sender;
        string ipfsCid;
        uint256 timestamp;
    }

    // jobId => participant address => message references
    mapping(uint256 => mapping(address => MessageRef[])) public jobMessageRefs;

    // === End Messaging Variables ===

    uint256 public jobCount;
    mapping(uint256 => Job) public jobs;

    event JobPosted(uint256 jobId, address employer, string title, uint256 budget);
    event JobApplied(uint256 jobId, address freelancer);
    event PaymentReleased(uint256 jobId, address freelancer, uint256 amount);
    event FreelancerSelected(uint256 jobId, address freelancer);

    // === Modified IPFS Messaging Event ===
    event MessageSent(uint256 jobId, address from, address to, string ipfsCid);

    modifier onlyEmployer(uint256 _jobId) {
        require(msg.sender == jobs[_jobId].employer, "Only employer can call this");
        _;
    }

    modifier jobExists(uint256 _jobId) {
        require(_jobId < jobCount, "Job does not exist");
        _;
    }

    function postJob(string memory _title, uint256 _budget) public payable {
        require(msg.value == _budget, "Escrow amount must match the job budget");

        Job memory newJob;
        newJob.jobId = jobCount;
        newJob.title = _title;
        newJob.budget = _budget;
        newJob.employer = msg.sender;
        newJob.freelancer = address(0);
        newJob.isTaken = false;
        newJob.isCompleted = false;
        newJob.isPaid = false;
        newJob.status = JobStatus.Open;

        jobs[jobCount] = newJob;

        emit JobPosted(jobCount, msg.sender, _title, _budget);
        jobCount++;
    }

    function applyForJob(uint256 _jobId) public jobExists(_jobId) {
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Open, "Job not open for applications");
        require(msg.sender != job.employer, "Employer cannot apply to own job");

        for (uint256 i = 0; i < job.applicants.length; i++) {
            require(job.applicants[i] != msg.sender, "Already applied");
        }

        job.applicants.push(msg.sender);
        emit JobApplied(_jobId, msg.sender);
    }

    function selectFreelancer(uint256 _jobId, address _freelancer) public jobExists(_jobId) onlyEmployer(_jobId) {
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Open, "Job not open for selection");
        require(job.freelancer == address(0), "Freelancer already selected");

        bool found = false;
        for (uint256 i = 0; i < job.applicants.length; i++) {
            if (job.applicants[i] == _freelancer) {
                found = true;
                break;
            }
        }
        require(found, "Freelancer did not apply");

        job.freelancer = address(uint160(_freelancer));
        job.status = JobStatus.InProgress;
        job.isTaken = true;

        emit FreelancerSelected(_jobId, _freelancer);
    }

    function releasePayment(uint256 _jobId) public jobExists(_jobId) onlyEmployer(_jobId) nonReentrant {
        Job storage job = jobs[_jobId];
        require(job.freelancer != address(0), "No freelancer selected");
        require(address(this).balance >= job.budget, "Insufficient funds");
        require(!job.isPaid, "Payment already released");

        job.isPaid = true;
        job.status = JobStatus.Completed;
        job.isCompleted = true;

        job.freelancer.transfer(job.budget); // ETH transfer after state update

        emit PaymentReleased(_jobId, job.freelancer, job.budget);
    }

    function getApplicants(uint256 _jobId) public view jobExists(_jobId) onlyEmployer(_jobId) returns (address[] memory) {
        return jobs[_jobId].applicants;
    }

    function getJob(uint256 _jobId) public view jobExists(_jobId)
        returns (string memory, uint256, address, address, JobStatus)
    {
        Job storage job = jobs[_jobId];
        return (job.title, job.budget, job.employer, job.freelancer, job.status);
    }

    // === IPFS Messaging Functions ===

    function sendMessageRef(uint256 _jobId, address _to, string memory _ipfsCid) public jobExists(_jobId) {
        Job storage job = jobs[_jobId];

        // Only employer or applicant can send message
        require(
            msg.sender == job.employer || isApplicant(_jobId, msg.sender),
            "Not authorized to send messages"
        );

        // Recipient must also be part of job
        require(
            _to == job.employer || isApplicant(_jobId, _to),
            "Recipient not authorized"
        );

        jobMessageRefs[_jobId][_to].push(MessageRef({
            sender: msg.sender,
            ipfsCid: _ipfsCid,
            timestamp: block.timestamp
        }));

        emit MessageSent(_jobId, msg.sender, _to, _ipfsCid);
    }

    function getMessageRefs(uint256 _jobId, address _participant)
        public
        view
        jobExists(_jobId)
        returns (MessageRef[] memory)
    {
        require(
            msg.sender == jobs[_jobId].employer || isApplicant(_jobId, msg.sender),
            "Not authorized to view messages"
        );
        return jobMessageRefs[_jobId][_participant];
    }

    function isApplicant(uint256 _jobId, address _user) internal view returns (bool) {
        Job storage job = jobs[_jobId];
        for (uint256 i = 0; i < job.applicants.length; i++) {
            if (job.applicants[i] == _user) {
                return true;
            }
        }
        return false;
    }
}