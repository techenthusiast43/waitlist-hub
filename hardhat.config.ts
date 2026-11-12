import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const rawPrivateKey = (process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
const accounts = rawPrivateKey
  ? [rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {},
    botchainTestnet: {
      url: process.env.BOTCHAIN_TESTNET_RPC || "https://rpc.bohr.life",
      chainId: 968,
      accounts,
      timeout: 60000,
    },
    botchainMainnet: {
      url: "https://rpc.botchain.ai",
      chainId: 677,
      accounts,
      timeout: 60000,
    },
  },
  etherscan: {
    apiKey: {
      botchainTestnet: "blockscout",
      botchainMainnet: "blockscout",
    },
    customChains: [
      {
        network: "botchainTestnet",
        chainId: 968,
        urls: {
          apiURL: "https://scan.bohr.life/api",
          browserURL: "https://scan.bohr.life",
        },
      },
      {
        network: "botchainMainnet",
        chainId: 677,
        urls: {
          apiURL: "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai",
        },
      },
    ],
  },
};

export default config;

