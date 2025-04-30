# JobBoard DApp

A decentralized application (DApp) that allows users to post jobs, apply for jobs, select freelancers, send messages related to jobs, and release payments upon completion.  
It is built using Solidity smart contracts, Web3.js, Truffle framework, and uses IPFS for decentralized off-chain message storage.

---
## *Team Information*
*Team Name:* HASHLINK  
*Team Members:*
- Kotha Ashrith Reddy  - 230001043
- Shrish Shriyans   -   230003072
- Buditi Deepak   -   230001016
- Avvaru Venkata Sai Deepak   -   230001011
- Vivek Tej Kanakam   -   230041014
- Bommireddy Varun Kumar Reddy   -   230041006

---
## Features

- **Post Jobs**: Employers can create new job listings with a title and budget.
- **Apply for Jobs**: Freelancers can view and apply for available jobs.
- **Select Freelancer**: Employers can select an applicant as the freelancer.
- **Messaging System**: Employers and freelancers can exchange messages tied to specific jobs.
- **Payment Release**: Employers can release payment to freelancers after job completion.
- **IPFS Storage**: Messages are stored on IPFS for decentralization; fallback to localStorage if IPFS is unavailable.
- **MetaMask Integration**: Users authenticate and interact using the MetaMask wallet.

---

## Technologies Used

- **Solidity**: Smart contract development for job posting and messaging.
- **Web3.js**: Communication between the frontend and Ethereum blockchain.
- **Truffle**: Smart contract development framework.
- **IPFS** (via `js-ipfs` or Infura): Off-chain message storage.
- **MetaMask**: Wallet integration for user account management.
- **HTML, CSS, JavaScript**: Frontend interface.

---

## Setup Instructions

1. **Install Dependencies**

   ```bash
   npm install -g truffle
   npm install ipfs-http-client
   ```
2. **Open Ganache and start a local blockchain (if not connected to a blockcahin)**

3. **Compile and Migrate Smart Contracts**

   ```bash
   truffle compile
   truffle migrate
   ```

4. **Start a Local IPFS Node (Optional)**

   ```bash
   npm install -g ipfs
   jsipfs init
   jsipfs daemon
   ```

5. **Run a Local HTTP Server**  
   Navigate to your frontend folder and run:

   ```bash
   python -m http.server 8000
   ```

6. **Access the DApp**  
   Open your browser and visit:  
   [http://localhost:8000](http://localhost:8000)

7. **MetaMask Setup**

   - Install the MetaMask extension.
   - Connect to the appropriate Ethereum network.

---

## Project Structure

```
contracts/        # Solidity smart contracts (JobBoard.sol, Migrations.sol)
migrations/       # Truffle migration scripts
src/
  ├── app.js      # Frontend logic (interaction with smart contracts and IPFS)
  └── index.html  # Frontend layout
test/             # Unit tests for smart contracts
truffle-config.js # Truffle project configuration
```

---

## Future Improvements

- Implement decentralized file attachments with IPFS.
- Add a job escrow system for payment security.
- Enhance UI/UX with frameworks like React.
- Deploy on a public Ethereum testnet or mainnet.

---

## License

This project is open-source.
