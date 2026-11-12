import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { http } from "viem";
import { botChainTestnet, BOT_CHAIN_TESTNET_RPC } from "./chain";

export const reownProjectId = (
  import.meta.env.VITE_REOWN_PROJECT_ID || ""
).trim();

export const hasConfiguredReownProjectId = Boolean(reownProjectId);

// Reown AppKit requires a non-empty string at initialization time; when the user
// hasn't added VITE_REOWN_PROJECT_ID yet, injected wallets still work via Wagmi
// while a setup banner informs them to populate .env.
const effectiveProjectId =
  reownProjectId || "00000000000000000000000000000000";

export const networks = [botChainTestnet] as [typeof botChainTestnet];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: effectiveProjectId,
  transports: {
    [botChainTestnet.id]: http(BOT_CHAIN_TESTNET_RPC, {
      timeout: 30_000,
    }),
  },
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: botChainTestnet,
  projectId: effectiveProjectId,
  metadata: {
    name: "WaitlistHub",
    description: "Decentralized FCFS Digital Waitlists on BOT Chain Testnet",
    url: typeof window !== "undefined" ? window.location.origin : "https://waitlisthub.local",
    icons: ["https://scan.bohr.life/favicon.ico"],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#14b8a6",
    "--w3m-border-radius-master": "10px",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

