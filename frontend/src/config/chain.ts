import { defineChain } from "viem";

export const BOT_CHAIN_TESTNET_ID = 968;
export const BOT_CHAIN_TESTNET_RPC = "https://rpc.bohr.life";
export const BOT_CHAIN_TESTNET_EXPLORER = "https://scan.bohr.life";
export const BOT_CHAIN_FAUCET_URL = "https://faucet.botchain.ai";

export const botChainTestnet = defineChain({
  id: BOT_CHAIN_TESTNET_ID,
  name: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [BOT_CHAIN_TESTNET_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "BOTScan Testnet",
      url: BOT_CHAIN_TESTNET_EXPLORER,
    },
  },
  testnet: true,
});

export function txExplorerUrl(hash: string): string {
  return `${BOT_CHAIN_TESTNET_EXPLORER}/tx/${hash}`;
}

export function addressExplorerUrl(address: string): string {
  return `${BOT_CHAIN_TESTNET_EXPLORER}/address/${address}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

