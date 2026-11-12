import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function upsertEnvKey(filePath: string, key: string, value: string) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lineRegex = new RegExp(`^${key}=.*$`, "m");
  const nextLine = `${key}=${value}`;

  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, nextLine);
  } else {
    content = content.trimEnd() + (content.length ? "\n" : "") + nextLine + "\n";
  }
  fs.writeFileSync(filePath, content, "utf8");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account configured. Set DEPLOYER_PRIVATE_KEY in .env first."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${network.name} (chainId=${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} BOT`);

  if (balance === 0n && network.name !== "hardhat" && network.name !== "localhost") {
    throw new Error(
      "Deployer balance is 0 BOT. Fund this address via https://faucet.botchain.ai first."
    );
  }

  const WaitlistHub = await ethers.getContractFactory("WaitlistHub");
  const hub = await WaitlistHub.deploy();
  const deployTx = hub.deploymentTransaction();
  console.log(`Deployment tx submitted: ${deployTx?.hash}`);

  await hub.waitForDeployment();
  const address = await hub.getAddress();
  console.log(`WaitlistHub deployed at: ${address}`);

  if (network.name === "botchainTestnet") {
    console.log(`Explorer: https://scan.bohr.life/address/${address}`);
    if (deployTx?.hash) {
      console.log(`Tx Link:  https://scan.bohr.life/tx/${deployTx.hash}`);
    }

    const rootDir = path.join(__dirname, "..");
    const rootEnv = path.join(rootDir, ".env");
    upsertEnvKey(rootEnv, "WAITLIST_HUB_ADDRESS", address);
    upsertEnvKey(rootEnv, "VITE_WAITLIST_HUB_ADDRESS", address);
    console.log("Synced deployed address into .env");
  }

  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    contractAddress: address,
    deployer: deployer.address,
    txHash: deployTx?.hash ?? null,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Saved deployment info to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
