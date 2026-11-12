import { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  Search,
  RefreshCw,
  Users,
  Sparkles,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { BOT_CHAIN_TESTNET_ID } from "../config/chain";
import {
  WAITLIST_HUB_ABI,
  WAITLIST_HUB_ADDRESS,
  type WaitlistData,
} from "../contracts/waitlistHub";
import { WaitlistCard } from "../components/WaitlistCard";

type FilterMode = "all" | "open" | "closed" | "mine";

interface BrowsePageProps {
  pendingActionKey: string | null;
  onJoin: (waitlistId: bigint) => void;
  onLeave: (waitlistId: bigint) => void;
  onManage: (waitlistId: bigint) => void;
  onGoCreate: () => void;
}

export function BrowsePage({
  pendingActionKey,
  onJoin,
  onLeave,
  onManage,
  onGoCreate,
}: BrowsePageProps) {
  const { address } = useAccount();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useReadContract({
    address: WAITLIST_HUB_ADDRESS ?? undefined,
    abi: WAITLIST_HUB_ABI,
    functionName: "getWaitlists",
    args: [0n, 100n],
    chainId: BOT_CHAIN_TESTNET_ID,
    query: {
      enabled: Boolean(WAITLIST_HUB_ADDRESS),
      refetchInterval: 10_000,
    },
  });

  const waitlists: WaitlistData[] = useMemo(() => {
    if (!data) return [];
    return [...data[0]]
      .map((w) => ({
        id: w.id,
        organiser: w.organiser,
        name: w.name,
        isOpen: w.isOpen,
        maxCapacity: Number(w.maxCapacity),
        activeCount: Number(w.activeCount),
        waitingCount: Number(w.waitingCount),
        calledCount: Number(w.calledCount),
        admittedCount: Number(w.admittedCount),
        totalEntries: Number(w.totalEntries),
      }))
      .sort((a, b) => Number(b.id - a.id));
  }, [data]);

  const filteredWaitlists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return waitlists.filter((w) => {
      if (filter === "open" && !w.isOpen) return false;
      if (filter === "closed" && w.isOpen) return false;
      if (
        filter === "mine" &&
        (!address || w.organiser.toLowerCase() !== address.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.id.toString() === q ||
        w.organiser.toLowerCase().includes(q)
      );
    });
  }, [waitlists, search, filter, address]);

  const stats = useMemo(() => {
    const openCount = waitlists.filter((w) => w.isOpen).length;
    const totalActive = waitlists.reduce((acc, w) => acc + w.activeCount, 0);
    const totalAdmitted = waitlists.reduce((acc, w) => acc + w.admittedCount, 0);
    return {
      total: waitlists.length,
      open: openCount,
      active: totalActive,
      admitted: totalAdmitted,
    };
  }, [waitlists]);

  return (
    <section className="page-section">
      <div className="hero-banner">
        <div>
          <span className="eyebrow">BOT Chain Testnet · Chain ID 968</span>
          <h1>On-Chain Digital Waitlists</h1>
          <p className="hero-subtitle">
            Join FCFS queues directly on-chain, track your real-time queue
            position, and manage admissions with transparent capacity rules.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary hero-cta"
          onClick={onGoCreate}
        >
          <Sparkles size={16} />
          <span>Create Waitlist</span>
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <Layers size={18} />
          </div>
          <div>
            <div className="kpi-label">Total Waitlists</div>
            <div className="kpi-value">{stats.total}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="kpi-label">Open Queues</div>
            <div className="kpi-value">{stats.open}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <Users size={18} />
          </div>
          <div>
            <div className="kpi-label">Active Spots Occupied</div>
            <div className="kpi-value">{stats.active}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="kpi-label">Total Admitted</div>
            <div className="kpi-value">{stats.admitted}</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by waitlist name, #ID, or organiser address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          {(["all", "open", "closed", "mine"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`filter-chip ${filter === mode ? "active" : ""}`}
              onClick={() => setFilter(mode)}
            >
              {mode === "all"
                ? "All"
                : mode === "open"
                ? "Open"
                : mode === "closed"
                ? "Closed"
                : "Created by Me"}
            </button>
          ))}
          <button
            type="button"
            className="btn-icon"
            onClick={() => refetch()}
            title="Refresh waitlists"
            aria-label="Refresh waitlists"
          >
            <RefreshCw size={15} className={isFetching ? "spin" : ""} />
          </button>
        </div>
      </div>

      {!WAITLIST_HUB_ADDRESS ? (
        <div className="empty-card">
          <h3>Contract Address Not Configured</h3>
          <p>
            Deploy <code>WaitlistHub</code> to BOT Chain Testnet and set{" "}
            <code>VITE_WAITLIST_HUB_ADDRESS</code> inside <code>.env</code>.
          </p>
        </div>
      ) : isLoading ? (
        <div className="cards-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card skeleton-card" />
          ))}
        </div>
      ) : filteredWaitlists.length === 0 ? (
        <div className="empty-card">
          <h3>No Waitlists Match</h3>
          <p>
            {waitlists.length === 0
              ? "No waitlists have been created on this contract yet. Be the first to launch one!"
              : "Try clearing your search or switching filter tabs."}
          </p>
          {waitlists.length === 0 && (
            <button type="button" className="btn-primary" onClick={onGoCreate}>
              Create First Waitlist
            </button>
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {filteredWaitlists.map((wl) => (
            <WaitlistCard
              key={wl.id.toString()}
              waitlist={wl}
              pendingActionKey={pendingActionKey}
              onJoin={onJoin}
              onLeave={onLeave}
              onManage={onManage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

