import { useState } from "react";
import { ExternalLink, AlertCircle, Activity } from "lucide-react";
import {
  BOT_CHAIN_TESTNET_EXPLORER,
  shortenAddress,
  txExplorerUrl,
} from "./config/chain";
import { hasConfiguredReownProjectId } from "./config/wagmi";
import { WAITLIST_HUB_ADDRESS } from "./contracts/waitlistHub";
import { useWaitlistTx } from "./hooks/useWaitlistTx";
import { Navbar, type AppTab } from "./components/Navbar";
import { ToastContainer } from "./components/ToastContainer";
import { BrowsePage } from "./pages/BrowsePage";
import { CreateWaitlistPage } from "./pages/CreateWaitlistPage";
import { OrganiserDashboardPage } from "./pages/OrganiserDashboardPage";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("browse");
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<bigint | null>(
    null
  );

  const {
    notifications,
    recentTxs,
    pendingActionKey,
    dismissNotification,
    executeTx,
  } = useWaitlistTx();

  async function handleCreate(name: string, maxCapacity: number) {
    return executeTx("create-waitlist", "Create Waitlist", "createWaitlist", [
      name,
      BigInt(maxCapacity),
    ]);
  }

  function handleJoin(waitlistId: bigint) {
    executeTx(
      `join-${waitlistId.toString()}`,
      `Join Waitlist #${waitlistId.toString()}`,
      "joinWaitlist",
      [waitlistId]
    );
  }

  function handleLeave(waitlistId: bigint) {
    executeTx(
      `leave-${waitlistId.toString()}`,
      `Leave Waitlist #${waitlistId.toString()}`,
      "leaveWaitlist",
      [waitlistId]
    );
  }

  function handleCallNext(waitlistId: bigint) {
    executeTx(
      `call-${waitlistId.toString()}`,
      `Call Next (#${waitlistId.toString()})`,
      "callNext",
      [waitlistId]
    );
  }

  function handleAdmit(waitlistId: bigint, user: `0x${string}`) {
    executeTx(
      `admit-${waitlistId.toString()}-${user}`,
      `Admit ${shortenAddress(user)}`,
      "admitUser",
      [waitlistId, user]
    );
  }

  function handleRemove(waitlistId: bigint, user: `0x${string}`) {
    executeTx(
      `remove-${waitlistId.toString()}-${user}`,
      `Remove ${shortenAddress(user)}`,
      "removeUser",
      [waitlistId, user]
    );
  }

  function handleCloseWaitlist(waitlistId: bigint) {
    executeTx(
      `close-${waitlistId.toString()}`,
      `Close Waitlist #${waitlistId.toString()}`,
      "closeWaitlist",
      [waitlistId]
    );
  }

  function handleManage(waitlistId: bigint) {
    setSelectedWaitlistId(waitlistId);
    setActiveTab("organiser");
  }

  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

      <main className="main-content">
        {(!WAITLIST_HUB_ADDRESS || !hasConfiguredReownProjectId) && (
          <div className="setup-banner">
            <AlertCircle size={16} />
            <div>
              <strong>Environment setup needed:</strong>{" "}
              {!WAITLIST_HUB_ADDRESS && (
                <span>
                  Set <code>VITE_WAITLIST_HUB_ADDRESS</code> after contract
                  deployment.{" "}
                </span>
              )}
              {!hasConfiguredReownProjectId && (
                <span>
                  Add <code>VITE_REOWN_PROJECT_ID</code> in <code>.env</code>{" "}
                  for WalletConnect modal relay.
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "browse" && (
          <BrowsePage
            pendingActionKey={pendingActionKey}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onManage={handleManage}
            onGoCreate={() => setActiveTab("create")}
          />
        )}

        {activeTab === "create" && (
          <CreateWaitlistPage
            pendingActionKey={pendingActionKey}
            onCreate={handleCreate}
            onSuccessRedirect={() => setActiveTab("organiser")}
          />
        )}

        {activeTab === "organiser" && (
          <OrganiserDashboardPage
            selectedWaitlistId={selectedWaitlistId}
            onSelectWaitlist={setSelectedWaitlistId}
            pendingActionKey={pendingActionKey}
            onCallNext={handleCallNext}
            onAdmitUser={handleAdmit}
            onRemoveUser={handleRemove}
            onCloseWaitlist={handleCloseWaitlist}
            onGoCreate={() => setActiveTab("create")}
          />
        )}

        {recentTxs.length > 0 && (
          <section className="card tx-history-card">
            <div className="tx-history-header">
              <Activity size={16} />
              <h3>Recent BOT Chain Transactions</h3>
            </div>
            <div className="tx-history-list">
              {recentTxs.map((tx) => (
                <div key={tx.hash} className="tx-history-item">
                  <div className="tx-history-left">
                    <span className={`tx-dot tx-${tx.status}`} />
                    <span>{tx.label}</span>
                  </div>
                  <a
                    href={txExplorerUrl(tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono-link"
                  >
                    {shortenAddress(tx.hash, 8)} <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>WaitlistHub · BOT Chain Testnet (Chain ID 968)</span>
          <div className="footer-links">
            {WAITLIST_HUB_ADDRESS && (
              <a
                href={`${BOT_CHAIN_TESTNET_EXPLORER}/address/${WAITLIST_HUB_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                Contract: {shortenAddress(WAITLIST_HUB_ADDRESS, 6)}{" "}
                <ExternalLink size={12} />
              </a>
            )}
            <a
              href={BOT_CHAIN_TESTNET_EXPLORER}
              target="_blank"
              rel="noreferrer"
            >
              BOTScan Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>

      <ToastContainer items={notifications} onDismiss={dismissNotification} />
    </div>
  );
}

export default App;

