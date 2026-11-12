import { useAppKit } from "@reown/appkit/react";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { formatEther } from "viem";
import {
  Layers,
  PlusCircle,
  LayoutDashboard,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { BOT_CHAIN_TESTNET_ID, shortenAddress } from "../config/chain";

export type AppTab = "browse" | "create" | "organiser";

interface NavbarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

export function Navbar({ activeTab, onChangeTab }: NavbarProps) {
  const { open } = useAppKit();
  const { address, chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balanceData } = useBalance({
    address,
    chainId: BOT_CHAIN_TESTNET_ID,
    query: { enabled: Boolean(address) },
  });

  const isWrongChain = isConnected && chainId !== BOT_CHAIN_TESTNET_ID;
  const formattedBalance = balanceData
    ? `${Number(formatEther(balanceData.value)).toFixed(3)} BOT`
    : null;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onChangeTab("browse")}
        >
          <span className="brand-mark">W</span>
          <span className="brand-text">
            Waitlist<span>Hub</span>
          </span>
        </button>

        <nav className="nav-tabs" aria-label="Primary navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === "browse" ? "active" : ""}`}
            onClick={() => onChangeTab("browse")}
          >
            <Layers size={16} />
            <span>Browse</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => onChangeTab("create")}
          >
            <PlusCircle size={16} />
            <span>Create Waitlist</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === "organiser" ? "active" : ""}`}
            onClick={() => onChangeTab("organiser")}
          >
            <LayoutDashboard size={16} />
            <span>Organiser</span>
          </button>
        </nav>

        <div className="nav-actions">
          {isWrongChain ? (
            <button
              type="button"
              className="btn-warning-pill"
              onClick={() => switchChain({ chainId: BOT_CHAIN_TESTNET_ID })}
              disabled={isSwitching}
            >
              <AlertTriangle size={14} />
              <span>{isSwitching ? "Switching..." : "Switch to BOT Testnet"}</span>
            </button>
          ) : (
            <div className="network-pill" title="BOT Chain Testnet (Chain ID 968)">
              <span className="status-dot" />
              <span>BOT Testnet · 968</span>
            </div>
          )}

          <button
            type="button"
            className={`btn-wallet ${isConnected ? "connected" : ""}`}
            onClick={() => open()}
          >
            <Wallet size={16} />
            {isConnected && address ? (
              <span className="wallet-label">
                {formattedBalance && (
                  <span className="wallet-balance">{formattedBalance}</span>
                )}
                <span>{shortenAddress(address)}</span>
              </span>
            ) : (
              <span>Connect Wallet</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

