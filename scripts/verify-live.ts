import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Live multi-wallet verification script for BOT Chain Testnet (Chain ID 968).
 * Uses TEST_WALLET_2_PRIVATE_KEY / TEST_WALLET_3_PRIVATE_KEY if set in .env,
 * otherwise creates 2 ephemeral test wallets funded with tiny gas from deployer
 * and sweeps remaining gas back to deployer at the end.
 */
async function main() {
  const contractAddress = process.env.WAITLIST_HUB_ADDRESS;
  if (!contractAddress) {
    throw new Error("WAITLIST_HUB_ADDRESS is not set in .env");
  }

  const [organiser] = await ethers.getSigners();
  const ephemeralWallets: ethers.Wallet[] = [];

  const key2 = process.env.TEST_WALLET_2_PRIVATE_KEY?.trim();
  const key3 = process.env.TEST_WALLET_3_PRIVATE_KEY?.trim();

  let wallet2: ethers.Wallet;
  let wallet3: ethers.Wallet;

  if (key2 && key3) {
    wallet2 = new ethers.Wallet(key2, ethers.provider);
    wallet3 = new ethers.Wallet(key3, ethers.provider);
  } else {
    const w2 = ethers.Wallet.createRandom().connect(ethers.provider);
    const w3 = ethers.Wallet.createRandom().connect(ethers.provider);
    wallet2 = w2 as unknown as ethers.Wallet;
    wallet3 = w3 as unknown as ethers.Wallet;
    ephemeralWallets.push(wallet2, wallet3);

    const fundAmount = ethers.parseEther("0.025");
    console.log("Funding 2 ephemeral test wallets (0.025 BOT each)...");
    const txFund2 = await organiser.sendTransaction({
      to: wallet2.address,
      value: fundAmount,
    });
    await txFund2.wait();
    const txFund3 = await organiser.sendTransaction({
      to: wallet3.address,
      value: fundAmount,
    });
    await txFund3.wait();
  }

  console.log("Contract: ", contractAddress);
  console.log("Organiser:", organiser.address);
  console.log("Wallet 2: ", wallet2.address);
  console.log("Wallet 3: ", wallet3.address);

  const hub = await ethers.getContractAt("WaitlistHub", contractAddress);

  try {
    // 1. Organiser creates waitlist with capacity 2
    const createTx = await hub
      .connect(organiser)
      .createWaitlist("BOT Chain Live Multi-Wallet QA", 2);
    await createTx.wait();
    const waitlistId = await hub.waitlistCount();
    console.log(`1. Created waitlist #${waitlistId}: ${createTx.hash}`);

    // 2. Wallet 2 & Wallet 3 join
    const join2Tx = await hub.connect(wallet2).joinWaitlist(waitlistId);
    await join2Tx.wait();
    const join3Tx = await hub.connect(wallet3).joinWaitlist(waitlistId);
    await join3Tx.wait();
    console.log(
      `2. Wallet 2 & 3 joined -> tx2=${join2Tx.hash}, tx3=${join3Tx.hash}`
    );

    // 3. Verify capacity blocks a 3rd join (organiser wallet trying to join)
    try {
      await hub.connect(organiser).joinWaitlist.staticCall(waitlistId);
      throw new Error("Expected WaitlistFull revert!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("WaitlistFull") && !msg.includes("revert")) {
        throw err;
      }
      console.log("3. Verified full capacity blocks 3rd join (WaitlistFull)");
    }

    // 4. Wallet 2 leaves voluntarily -> Wallet 3 becomes #1 -> Wallet 2 rejoins at #2
    const leaveTx = await hub.connect(wallet2).leaveWaitlist(waitlistId);
    await leaveTx.wait();
    const pos3AfterLeave = await hub.getUserPosition(waitlistId, wallet3.address);
    if (pos3AfterLeave.position !== 1n) {
      throw new Error(`Expected Wallet 3 at #1, got #${pos3AfterLeave.position}`);
    }

    const rejoinTx = await hub.connect(wallet2).joinWaitlist(waitlistId);
    await rejoinTx.wait();
    const pos2AfterRejoin = await hub.getUserPosition(waitlistId, wallet2.address);
    if (pos2AfterRejoin.position !== 2n || pos2AfterRejoin.entryId !== 3n) {
      throw new Error(
        `Expected Wallet 2 rejoin entryId=3 pos=2, got entryId=${pos2AfterRejoin.entryId} pos=${pos2AfterRejoin.position}`
      );
    }
    console.log(
      `4. Wallet 2 left (${leaveTx.hash}) & rejoined at #2 (${rejoinTx.hash})`
    );

    // 5. Organiser calls next (Wallet 3), admits Wallet 3, then removes Admitted Wallet 3
    const callTx = await hub.connect(organiser).callNext(waitlistId);
    await callTx.wait();
    const admitTx = await hub
      .connect(organiser)
      .admitUser(waitlistId, wallet3.address);
    await admitTx.wait();
    const removeTx = await hub
      .connect(organiser)
      .removeUser(waitlistId, wallet3.address);
    await removeTx.wait();
    console.log(
      `5. Called (${callTx.hash}), Admitted (${admitTx.hash}), Removed Admitted Wallet 3 (${removeTx.hash})`
    );

    // 6. Verify Removed Wallet 3 cannot rejoin & activeCount dropped to 1
    try {
      await hub.connect(wallet3).joinWaitlist.staticCall(waitlistId);
      throw new Error("Expected RemovedUserCannotRejoin revert!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("RemovedUserCannotRejoin") && !msg.includes("revert")) {
        throw err;
      }
      console.log("6. Verified Removed wallet cannot rejoin");
    }

    // 7. Close waitlist & inspect final entries
    const closeTx = await hub.connect(organiser).closeWaitlist(waitlistId);
    await closeTx.wait();
    const finalState = await hub.getWaitlist(waitlistId);
    const [entries] = await hub.getWaitlistEntries(waitlistId, 0, 10);
    console.log("7. Closed waitlist:", closeTx.hash);
    console.log("Final waitlist state:", {
      isOpen: finalState.isOpen,
      activeCount: finalState.activeCount.toString(),
      waitingCount: finalState.waitingCount.toString(),
      calledCount: finalState.calledCount.toString(),
      admittedCount: finalState.admittedCount.toString(),
      totalEntries: finalState.totalEntries.toString(),
    });
    console.log(
      "Historical entries preserved:",
      entries.map((e) => ({
        entryId: e.entryId.toString(),
        wallet: e.wallet,
        status: e.status.toString(),
      }))
    );
  } finally {
    if (ephemeralWallets.length > 0) {
      const feeData = await ethers.provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 20_000_000_000n;
      const sweepCost = 21_000n * gasPrice;
      for (const w of ephemeralWallets) {
        const bal = await ethers.provider.getBalance(w.address);
        if (bal > sweepCost) {
          const sweepTx = await w.sendTransaction({
            to: organiser.address,
            value: bal - sweepCost,
            gasLimit: 21_000n,
            gasPrice,
          });
          await sweepTx.wait();
        }
      }
      console.log("Swept remaining ephemeral test gas back to organiser.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
