# WaitlistHub — BOT Chain Testnet dApp

Decentralized first-come, first-served (FCFS) digital waitlist application built for **BOT Chain Testnet (Chain ID 968)**.

## Network Configuration (BOT Chain Testnet)
- **Network Name:** BOT Chain Testnet
- **Chain ID:** `968` (`0x3c8`)
- **RPC URL:** `https://rpc.bohr.life`
- **Native Token:** `BOT` (18 decimals)
- **Explorer:** `https://scan.bohr.life/`
- **Faucet:** `https://faucet.botchain.ai`

## Deployed Contract
- **Contract (`WaitlistHub`):** `0xe770F12345792e325C32BF3D834EaAEaC701b51A`
- **BOTScan Verified Code:** https://scan.bohr.life/address/0xe770F12345792e325C32BF3D834EaAEaC701b51A#code
- **Deployment Tx:** https://scan.bohr.life/tx/0xb6d40679c538ea528b7e8f432e164e7cb91fcf6ad5d2aa5b8a6dee5db0758a8b

---

## Smart Contract Architecture (`contracts/WaitlistHub.sol`)
- **Active Capacity Accounting:** `maxCapacity` counts only `Waiting`, `Called`, and `Admitted` participants. Leaving (`Left`) or removal (`Removed`) immediately frees a spot.
- **Controlled Re-joining:**
  - `Waiting`, `Called`, and `Admitted` wallets cannot join again.
  - `Left` wallets may rejoin with a new `entryId` at the back of the queue (preserving old historical entries without counting them toward active capacity).
  - `Removed` wallets cannot rejoin.
- **Organiser Controls:** `callNext`, `admitUser` (from `Waiting` or `Called`), `removeUser` (from `Waiting`, `Called`, or `Admitted`), and `closeWaitlist`.
- **Gas Efficiency:** Packed structs and an O(1) doubly-linked list for the active waiting queue.

---

## Setup & Deployment Instructions

### 1. Populate Environment Variables
Edit `.env` in the project root:
```env
DEPLOYER_PRIVATE_KEY=0xYOUR_FUNDED_BOT_TESTNET_PRIVATE_KEY
VITE_REOWN_PROJECT_ID=YOUR_REOWN_CLOUD_PROJECT_ID
TEST_WALLET_2_PRIVATE_KEY=0xOPTIONAL_SECOND_WALLET_FOR_LIVE_TEST
TEST_WALLET_3_PRIVATE_KEY=0xOPTIONAL_THIRD_WALLET_FOR_LIVE_TEST
BOTCHAIN_TESTNET_RPC=https://rpc.bohr.life
WAITLIST_HUB_ADDRESS=
VITE_WAITLIST_HUB_ADDRESS=
```
*(Get a Reown Project ID at https://dashboard.reown.com/ and testnet BOT at https://faucet.botchain.ai. Vite loads `.env` from the project root automatically and only exposes `VITE_*` variables to the browser.)*

### 2. Run Smart Contract Unit Tests
```bash
npm run test
```

### 3. Deploy to BOT Chain Testnet
```bash
npm run deploy:testnet
```
Deploying automatically saves `deployment.json` and populates `WAITLIST_HUB_ADDRESS` and `VITE_WAITLIST_HUB_ADDRESS` in `.env`.

### 4. Verify Contract on BOTScan (Optional)
```bash
npx hardhat verify --network botchainTestnet <DEPLOYED_CONTRACT_ADDRESS>
```

### 5. Run Multi-Wallet Live Verification on BOT Chain Testnet (Optional)
Once `TEST_WALLET_2_PRIVATE_KEY` and `TEST_WALLET_3_PRIVATE_KEY` are funded with testnet `BOT`:
```bash
npm run verify:testnet
```

### 6. Start the Frontend
```bash
cd frontend
npm run dev
```
*(On Windows PowerShell if execution policy restricts `npm`, run `npm.cmd run dev`.)*

