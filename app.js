// Global variables
let jb;
let ipfs;

// app.module.js
async function initializeIpfs() {
  try {
    // Import IPFS from window object
    const { create } = window.IpfsHttpClient;

    // Connect to local IPFS node
    ipfs = create({
      host: 'localhost',
      port: 5001,
      protocol: 'http',
    });

    const id = await ipfs.id();
    console.log("IPFS client initialized. Node ID:", id.id);

    const statusElement = document.getElementById('ipfsStatus');
    if (statusElement) {
      statusElement.className = "ipfs-status ipfs-connected";
      statusElement.textContent = "IPFS: Connected (Local)";
    }

    return true;
  } catch (error) {
    console.error("Failed to initialize local IPFS client:", error);

    const statusElement = document.getElementById('ipfsStatus');
    if (statusElement) {
      statusElement.className = "ipfs-status ipfs-disconnected";
      statusElement.textContent = "IPFS: Disconnected (Using Local Storage)";
    }

    return false;
  }
}
window.addEventListener("load", initializeIpfs);



window.addEventListener("load", async () => {
  await initializeIpfs();
  
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      window.ethereum.on('accountsChanged', function (accounts) {
        console.log('Account changed to:', accounts[0]);
        updateCurrentAccount(accounts[0]);
        loadJobs();
      });

      const accounts = await web3.eth.getAccounts();
      updateCurrentAccount(accounts[0]);

      const contractData = await fetch("build/contracts/JobBoard.json").then(res => res.json());
      const abi = contractData.abi;
      const networkId = await web3.eth.net.getId();

      if (!contractData.networks[networkId]) {
        alert("JobBoard contract not deployed on this network.");
        return;
      }

      const address = contractData.networks[networkId].address;
      jb = new web3.eth.Contract(abi, address);

      console.log("Connected to JobBoard at:", address);

      loadJobs();
      updateUI();
    } catch (error) {
      console.error("User denied account access:", error);
      alert("Please allow MetaMask access to use this app.");
    }
  } else {
    alert("Please install MetaMask to use this app.");
  }
});

function updateCurrentAccount(account) {
  window.currentAccount = account;
  
  const accountDisplay = document.getElementById("currentAccount");
  if (accountDisplay) {
    accountDisplay.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
  }
}

function updateUI() {
  const jobSelector = document.getElementById("jobSelector");
  if (jobSelector) {
    const selectedJobId = jobSelector.value;
    if (selectedJobId) {
      document.getElementById("messageJobId").value = selectedJobId;
      loadJobDetails(selectedJobId);
      loadMessages(selectedJobId);
    }
  }
}

async function postJob() {
  const title = document.getElementById("jobTitle").value;
  const budgetInEth = document.getElementById("jobBudget").value;

  if (!title || !budgetInEth) {
    alert("Please fill in both job title and budget.");
    return;
  }

  const budget = web3.utils.toWei(budgetInEth, "ether");
  const budgetBN = web3.utils.toBN(budget);

  try {
    console.log("Title:", title);
    console.log("Budget (ETH):", budgetInEth);
    console.log("Budget (Wei):", budgetBN.toString());

    const receipt = await jb.methods.postJob(title, budgetBN).send({
      from: window.currentAccount,
      value: budgetBN
    });

    const event = receipt.events.JobPosted;
    if (event) {
      const jobId = event.returnValues.jobId;
      console.log("Job posted successfully! Job ID:", jobId);
      alert(`Job posted successfully! Job ID: ${jobId}`);
    } else {
      console.warn(" No JobPosted event found in transaction receipt");
    }

    document.getElementById("jobTitle").value = "";
    document.getElementById("jobBudget").value = "";
    loadJobs();
  } catch (e) {
    console.error(" Failed to post job:", e);
    alert("Failed to post job. Check console for details.");
  }
}

async function loadJobs() {
  console.log("Loading jobs...");
  
  const jobsContainer = document.getElementById("jobs");
  jobsContainer.innerHTML = "<h3>Available Jobs</h3>";
  
  const jobSelector = document.getElementById("jobSelector");
  if (jobSelector) {
    jobSelector.innerHTML = "<option value=''>Select a job</option>";
  }

  let id = 0;
  while (true) {
    try {
      const job = await jb.methods.getJob(id).call();
      console.log("Job found:", job);

      const status = ["Open", "InProgress", "Completed"][job[4]];
      
      // Add job ID to the display
      const html = `
        <div class="job-card">
          <h3>${job[0]} (ID: ${id})</h3>
          <p>Budget: ${web3.utils.fromWei(job[1], "ether")} ETH</p>
          <p>Status: ${status}</p>
          <p>Employer: ${job[2]}</p>
          <p>Freelancer: ${job[3] !== "0x0000000000000000000000000000000000000000" ? job[3] : "Not assigned"}</p>
          <div class="job-actions">
            <button onclick="apply(${id})">Apply</button>
            <button onclick="viewApplicants(${id})">View Applicants</button>
            <button onclick="selectJobForMessage(${id})">Message</button>
          </div>
        </div>
      `;
      jobsContainer.innerHTML += html;
      
      // Add job to selector with ID included in the option text
      if (jobSelector) {
        jobSelector.innerHTML += `<option value="${id}">${job[0]} (ID: ${id})</option>`;
      }
      
      id++;
    } catch (err) {
      console.log("No more jobs or error. Stopping at ID:", id);
      break;
    }
  }
  
  if (id === 0) {
    jobsContainer.innerHTML += "<p>No jobs found. Create one!</p>";
  }
}

async function apply(jobId) {
  try {
    const receipt = await jb.methods.applyForJob(jobId).send({ from: window.currentAccount });
    console.log("✅ Applied for job:", receipt);
    alert("Successfully applied for the job!");
  } catch (e) {
    console.error("❌ Failed to apply:", e);
    alert("Failed to apply for the job. Check console for details.");
  }
}

async function viewApplicants(jobId) {
  try {
    const job = await jb.methods.getJob(jobId).call();
    
    if (job[2].toLowerCase() !== window.currentAccount.toLowerCase()) {
      alert("Only the employer can view applicants.");
      return;
    }
    
    const applicants = await jb.methods.getApplicants(jobId).call({ from: window.currentAccount });
    
    if (applicants.length === 0) {
      alert("No applicants yet for this job.");
      return;
    }
    
    const applicantsList = document.getElementById("applicantsList");
    applicantsList.innerHTML = "<h4>Applicants</h4>";
    
    applicants.forEach(applicant => {
      applicantsList.innerHTML += `
        <div>
          <p>${applicant}</p>
          <button onclick="selectFreelancer(${jobId}, '${applicant}')">Select Freelancer</button>
          <button onclick="prepareMessage(${jobId}, '${applicant}')">Message</button>
        </div>
      `;
    });
    
    document.getElementById("applicantsSection").style.display = "block";
  } catch (e) {
    console.error("Failed to view applicants:", e);
    alert("Failed to view applicants. Check console for details.");
  }
}

async function selectFreelancer(jobId, freelancer) {
  try {
    const receipt = await jb.methods.selectFreelancer(jobId, freelancer).send({ 
      from: window.currentAccount 
    });
    console.log("Freelancer selected:", receipt);
    alert("Freelancer selected successfully!");
    loadJobs();
  } catch (e) {
    console.error("Failed to select freelancer:", e);
    alert("Failed to select freelancer. Check console for details.");
  }
}

async function releasePayment(jobId) {
  try {
    const job = await jb.methods.getJob(jobId).call();
    
    if (job[2].toLowerCase() !== window.currentAccount.toLowerCase()) {
      alert("Only the employer can release payment.");
      return;
    }
    
    const receipt = await jb.methods.releasePayment(jobId).send({ 
      from: window.currentAccount
    });
    console.log("Payment released:", receipt);
    alert("Payment released successfully!");
    loadJobs();
  } catch (e) {
    console.error("Failed to release payment:", e);
    alert("Failed to release payment. Check console for details.");
  }
}

async function storeMessageInIPFS(message) {
  try {
    if (!ipfs) {
      throw new Error("IPFS client not initialized");
    }
    
    const messageObj = {
      content: message,
      timestamp: Date.now(),
      sender: window.currentAccount
    };
    
    const messageString = JSON.stringify(messageObj);
    const messageBuffer = new TextEncoder().encode(messageString);
    
    const result = await ipfs.add(messageBuffer);
    console.log("Message stored in IPFS with CID:", result.path);
    
    return result.path;
  } catch (error) {
    console.error("Failed to store message in IPFS:", error);
    throw error;
  }
}

async function getMessageFromIPFS(cid) {
  if (cid.startsWith('local-storage-')) {
    const localId = cid.replace('local-storage-', 'msg-');
    try {
      const storedMessage = localStorage.getItem(localId);
      if (storedMessage) {
        return JSON.parse(storedMessage);
      } else {
        return { 
          content: "Message data no longer available in local storage", 
          timestamp: Date.now(),
          sender: "unknown"
        };
      }
    } catch (e) {
      console.error("Error retrieving from localStorage:", e);
      return { 
        content: "Error retrieving message from local storage", 
        timestamp: Date.now(),
        sender: "unknown"
      };
    }
  }
  
  try {
    if (!ipfs) {
      throw new Error("IPFS client not initialized");
    }
    
    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    
    const decoder = new TextDecoder();
    const content = decoder.decode(concatenateUint8Arrays(chunks));
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to retrieve message from IPFS:", error);
    return { 
      content: "Error retrieving message from IPFS", 
      timestamp: Date.now() 
    };
  }
}

// Helper function to concatenate Uint8Array objects
function concatenateUint8Arrays(arrays) {
  let totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  let result = new Uint8Array(totalLength);
  let offset = 0;
  for (let arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function storeMessageWithFallback(message) {
  try {
    if (ipfs) {
      return await storeMessageInIPFS(message);
    } else {
      throw new Error("IPFS not initialized");
    }
  } catch (error) {
    console.warn("IPFS storage failed, using localStorage fallback");
    
    try {
      const fallbackId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const messageObj = {
        content: message,
        timestamp: Date.now(),
        sender: window.currentAccount
      };
      localStorage.setItem(`msg-${fallbackId}`, JSON.stringify(messageObj));
      
      // Update status indicator
      const statusElement = document.getElementById('messageStorageStatus');
      if (statusElement) {
        statusElement.className = "status-indicator status-success";
        statusElement.textContent = "Message stored locally (IPFS unavailable)";
        
        // Hide the status after 3 seconds
        setTimeout(() => {
          statusElement.textContent = "";
          statusElement.className = "";
        }, 3000);
      }
      
      return `local-storage-${fallbackId}`;
    } catch (e) {
      console.error("LocalStorage fallback also failed:", e);
      
      // Update status indicator
      const statusElement = document.getElementById('messageStorageStatus');
      if (statusElement) {
        statusElement.className = "status-indicator status-error";
        statusElement.textContent = "Failed to store message";
        
        // Hide the status after 3 seconds
        setTimeout(() => {
          statusElement.textContent = "";
          statusElement.className = "";
        }, 3000);
      }
      
      return "error-storing-message";
    }
  }
}

function selectJobForMessage(jobId) {
  document.getElementById("jobSelector").value = jobId;
  document.getElementById("messageJobId").value = jobId;
  loadJobDetails(jobId);
  loadMessages(jobId);
  document.getElementById("messagesSection").style.display = "block";
  
  document.getElementById("messagesSection").scrollIntoView({
    behavior: 'smooth'
  });
}

function prepareMessage(jobId, recipient) {
  document.getElementById("messageJobId").value = jobId;
  document.getElementById("messageRecipient").value = recipient;
  document.getElementById("messagesSection").style.display = "block";
  
  loadMessages(jobId, recipient);
  
  document.getElementById("messagesSection").scrollIntoView({
    behavior: 'smooth'
  });
}

async function loadJobDetails(jobId) {
  try {
    const job = await jb.methods.getJob(jobId).call();
    
    const messageRecipientsSelect = document.getElementById("messageRecipient");
    messageRecipientsSelect.innerHTML = "";
    
    if (job[2].toLowerCase() !== window.currentAccount.toLowerCase()) {
      messageRecipientsSelect.innerHTML += `<option value="${job[2]}">Employer: ${job[2]}</option>`;
    }
    
    if (job[3] !== "0x0000000000000000000000000000000000000000" && 
        job[3].toLowerCase() !== window.currentAccount.toLowerCase()) {
      messageRecipientsSelect.innerHTML += `<option value="${job[3]}">Freelancer: ${job[3]}</option>`;
    }
    
    if (job[2].toLowerCase() === window.currentAccount.toLowerCase()) {
      try {
        const applicants = await jb.methods.getApplicants(jobId).call({ from: window.currentAccount });
        applicants.forEach(applicant => {
          if (applicant.toLowerCase() !== job[3].toLowerCase()) {
            messageRecipientsSelect.innerHTML += `<option value="${applicant}">Applicant: ${applicant}</option>`;
          }
        });
      } catch (e) {
        console.error("Could not load applicants:", e);
      }
    }
    
    const actionsSection = document.getElementById("actionsSection");
    actionsSection.innerHTML = "<h3>Job Actions</h3>";
    
    if (job[4] == 0) { // Open job
      if (job[2].toLowerCase() === window.currentAccount.toLowerCase()) {
        actionsSection.innerHTML += `<button onclick="viewApplicants(${jobId})">View Applicants</button>`;
      } else {
        actionsSection.innerHTML += `<button onclick="apply(${jobId})">Apply for Job</button>`;
      }
    } else if (job[4] == 1) { // In progress
      if (job[2].toLowerCase() === window.currentAccount.toLowerCase()) {
        actionsSection.innerHTML += `<button onclick="releasePayment(${jobId})">Release Payment</button>`;
      }
    }
    
  } catch (e) {
    console.error("Failed to load job details:", e);
  }
}

async function sendMessage() {
  const jobId = document.getElementById("messageJobId").value;
  const recipient = document.getElementById("messageRecipient").value;
  const message = document.getElementById("messageInput").value;
  
  if (!jobId || !recipient || !message) {
    alert("Please select a job, recipient, and enter a message.");
    return;
  }
  
  try {
    const sendButton = document.getElementById("sendButton");
    sendButton.disabled = true;
    sendButton.textContent = "Sending...";
    
    let ipfsCid;
    try {
      ipfsCid = await storeMessageWithFallback(message);
    } catch (error) {
      console.error("Message storage failed completely:", error);
      alert("Failed to store message. Please try again later.");
      sendButton.disabled = false;
      sendButton.textContent = "Send Message";
      return;
    }
    
    const receipt = await jb.methods.sendMessageRef(jobId, recipient, ipfsCid).send({ 
      from: window.currentAccount 
    });
    
    console.log("Message reference stored on blockchain:", receipt);
    
    document.getElementById("messageInput").value = "";
    sendButton.disabled = false;
    sendButton.textContent = "Send Message";
    
    // Update status indicator to show success
    const statusElement = document.getElementById('messageStorageStatus');
    if (statusElement) {
      statusElement.className = "status-indicator status-success";
      statusElement.textContent = "Message sent successfully!";
      
      // Hide the status after 3 seconds
      setTimeout(() => {
        statusElement.textContent = "";
        statusElement.className = "";
      }, 3000);
    }
    
    loadMessages(jobId, recipient);
  } catch (e) {
    console.error("Failed to send message:", e);
    alert("Failed to send message. Check console for details.");
    document.getElementById("sendButton").disabled = false;
    document.getElementById("sendButton").textContent = "Send Message";
    
    // Update status indicator to show error
    const statusElement = document.getElementById('messageStorageStatus');
    if (statusElement) {
      statusElement.className = "status-indicator status-error";
      statusElement.textContent = "Failed to send message";
      
      // Hide the status after 3 seconds
      setTimeout(() => {
        statusElement.textContent = "";
        statusElement.className = "";
      }, 3000);
    }
  }
}

async function loadMessages(jobId, specificRecipient = null) {
  try {
    const messageContainer = document.getElementById("messageContainer");
    messageContainer.innerHTML = "<h4>Messages</h4>";
    
    if (specificRecipient) {
      try {
        const myMessageRefs = await jb.methods.getMessageRefs(jobId, window.currentAccount).call({ 
          from: window.currentAccount 
        });
        
        const sentMessageRefs = await jb.methods.getMessageRefs(jobId, specificRecipient).call({ 
          from: window.currentAccount 
        });
        
        const conversationRefs = [
          ...myMessageRefs.filter(msg => msg.sender.toLowerCase() === specificRecipient.toLowerCase()),
          ...sentMessageRefs.filter(msg => msg.sender.toLowerCase() === window.currentAccount.toLowerCase())
        ];
        
        conversationRefs.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
        
        messageContainer.innerHTML += `<p id="loadingMessages">Loading messages...</p>`;
        
        const messages = [];
        for (const ref of conversationRefs) {
          try {
            if (ref.ipfsCid === "error-storing-message") {
              messages.push({
                content: "(Message unavailable - storage failed)",
                sender: ref.sender,
                timestamp: parseInt(ref.timestamp) * 1000
              });
            } else {
              const message = await getMessageFromIPFS(ref.ipfsCid);
              messages.push({
                content: message.content || "Error retrieving message content",
                sender: ref.sender,
                timestamp: parseInt(ref.timestamp) * 1000
              });
            }
          } catch (error) {
            console.error("Error retrieving message:", error);
            messages.push({
              content: "Error retrieving message",
              sender: ref.sender,
              timestamp: parseInt(ref.timestamp) * 1000
            });
          }
        }
        
        const loadingElement = document.getElementById("loadingMessages");
        if (loadingElement) {
          loadingElement.remove();
        }
        
        displayMessages(messages);
        
      } catch (e) {
        console.error("Could not load specific messages:", e);
        messageContainer.innerHTML += `<p>Error loading messages: ${e.message}</p>`;
      }
    } else {
      try {
        const myMessageRefs = await jb.methods.getMessageRefs(jobId, window.currentAccount).call({ 
          from: window.currentAccount 
        });
        
        if (myMessageRefs.length === 0) {
          messageContainer.innerHTML += "<p>No messages yet.</p>";
          return;
        }
        
        messageContainer.innerHTML += `<p id="loadingMessages">Loading messages...</p>`;
        
        const messages = [];
        for (const ref of myMessageRefs) {
          try {
            if (ref.ipfsCid === "error-storing-message") {
              messages.push({
                content: "(Message unavailable - storage failed)",
                sender: ref.sender,
                timestamp: parseInt(ref.timestamp) * 1000
              });
            } else {
              const message = await getMessageFromIPFS(ref.ipfsCid);
              messages.push({
                content: message.content || "Error retrieving message content",
                sender: ref.sender,
                timestamp: parseInt(ref.timestamp) * 1000
              });
            }
          } catch (error) {
            console.error("Error retrieving message:", error);
            messages.push({
              content: "Error retrieving message",
              sender: ref.sender,
              timestamp: parseInt(ref.timestamp) * 1000
            });
          }
        }
        
        const loadingElement = document.getElementById("loadingMessages");
        if (loadingElement) {
          loadingElement.remove();
        }
        
        displayMessages(messages);
      } catch (e) {
        console.error("Could not load messages:", e);
        messageContainer.innerHTML += `<p>Error loading messages: ${e.message}</p>`;
      }
    }
  } catch (e) {
    console.error("Failed to load messages:", e);
    document.getElementById("messageContainer").innerHTML += `<p>Error loading messages: ${e.message}</p>`;
  }
}

function displayMessages(messages) {
  const messageContainer = document.getElementById("messageContainer");
  
  if (messages.length === 0) {
    messageContainer.innerHTML += "<p>No messages yet.</p>";
    return;
  }
  
  messages.forEach(msg => {
    const isFromMe = msg.sender.toLowerCase() === window.currentAccount.toLowerCase();
    const messageClass = isFromMe ? "sent-message" : "received-message";
    
    const messageHtml = `
      <div class="${messageClass}">
        <p><strong>${isFromMe ? "Me" : "From: " + shortenAddress(msg.sender)}</strong></p>
        <p>${msg.content}</p>
        <p><small>${new Date(msg.timestamp).toLocaleString()}</small></p>
      </div>
    `;
    messageContainer.innerHTML += messageHtml;
  });
  
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}

// Check IPFS connection status periodically
setInterval(async function() {
  if (!ipfs) return;
  
  try {
    await ipfs.id();
    const statusElement = document.getElementById('ipfsStatus');
    if (statusElement) {
      statusElement.className = "ipfs-status ipfs-connected";
      statusElement.textContent = "IPFS: Connected";
    }
  } catch (e) {
    const statusElement = document.getElementById('ipfsStatus');
    if (statusElement) {
      statusElement.className = "ipfs-status ipfs-disconnected";
      statusElement.textContent = "IPFS: Disconnected (Using Local Storage)";
    }
  }
}, 10000);