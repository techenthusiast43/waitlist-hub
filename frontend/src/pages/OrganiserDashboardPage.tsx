import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  BellRing,
  Check,
  UserX,
  Lock,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  BOT_CHAIN_TESTNET_ID,
  addressExplorerUrl,
  shortenAddress,
} from "../config/chain";
import {
  EntryStatus,
  STATUS_LABELS,
  WAITLIST_HUB_ABI,
  WAITLIST_HUB_ADDRESS,
  type WaitlistData,
  type WaitlistEntryData,
} from "../contracts/waitlistHub";

type EntryFilter = "all" | "waiting" | "called" | "admitted" | "inactive";

interface OrganiserDashboardPageProps {
  selectedWaitlistId: bigint | null;
  onSelectWaitlist: (id: bigint) => void;
  pendingActionKey: string | null;
  onCallNext: (waitlistId: bigint) => void;
  onAdmitUser: (waitlistId: bigint, user: `0x${string}`) => void;
  onRemoveUser: (waitlistId: bigint, user: `0x${string}`) => void;
  onCloseWaitlist: (waitlistId: bigint) => void;
  onGoCreate: () => void;
}

export function OrganiserDashboardPage({
  selectedWaitlistId,
  onSelectWaitlist,
  pendingActionKey,
  onCallNext,
  onAdmitUser,
  onRemoveUser,
  onCloseWaitlist,
  onGoCreate,
}: OrganiserDashboardPageProps) {
  const { address, isConnected } = useAccount();
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");

  const { data: allWaitlistsData, refetch: refetchWaitlists } = useReadContract(
    {
      address: WAITLIST_HUB_ADDRESS ?? undefined,
      abi: WAITLIST_HUB_ABI,
      functionName: "getWaitlists",
      args: [0n, 100n],
      chainId: BOT_CHAIN_TESTNET_ID,
      query: {
        enabled: Boolean(WAITLIST_HUB_ADDRESS),
        refetchInterval: 10_000,
      },
    }
  );

  const ownedWaitlists: WaitlistData[] = useMemo(() => {
    if (!allWaitlistsData || !address) return [];
    const lower = address.toLowerCase();
    return [...allWaitlistsData[0]]
      .filter((w) => w.organiser.toLowerCase() === lower)
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
  }, [allWaitlistsData, address]);

  const activeWaitlist = useMemo(() => {
    if (ownedWaitlists.length === 0) return null;
    if (selectedWaitlistId !== null) {
      const match = ownedWaitlists.find((w) => w.id === selectedWaitlistId);
      if (match) return match;
    }
    return ownedWaitlists[0];
  }, [ownedWaitlists, selectedWaitlistId]);

  useEffect(() => {
    if (
      activeWaitlist &&
      (!selectedWaitlistId ||
        !ownedWaitlists.some((w) => w.id === selectedWaitlistId))
    ) {
      onSelectWaitlist(activeWaitlist.id);
    }
  }, [activeWaitlist, ownedWaitlists, selectedWaitlistId, onSelectWaitlist]);

  const {
    data: entriesData,
    isFetching: isFetchingEntries,
    refetch: refetchEntries,
  } = useReadContract({
    address: WAITLIST_HUB_ADDRESS ?? undefined,
    abi: WAITLIST_HUB_ABI,
    functionName: "getWaitlistEntries",
    args: activeWaitlist ? [activeWaitlist.id, 0n, 200n] : undefined,
    chainId: BOT_CHAIN_TESTNET_ID,
    query: {
      enabled: Boolean(WAITLIST_HUB_ADDRESS && activeWaitlist),
      refetchInterval: 8_000,
    },
  });

  const entriesWithPosition = useMemo(() => {
    if (!entriesData) return [];
    let waitingRank = 0;
    return entriesData[0].map((raw) => {
      const entry: WaitlistEntryData = {
        entryId: Number(raw.entryId),
        wallet: raw.wallet,
        status: Number(raw.status) as EntryStatus,
      };
      const queuePos =
        entry.status === EntryStatus.Waiting ? ++waitingRank : null;
      return { ...entry, queuePos };
    });
  }, [entriesData]);

  const filteredEntries = useMemo(() => {
    return entriesWithPosition.filter((e) => {
      if (entryFilter === "waiting") return e.status === EntryStatus.Waiting;
      if (entryFilter === "called") return e.status === EntryStatus.Called;
      if (entryFilter === "admitted") return e.status === EntryStatus.Admitted;
      if (entryFilter === "inactive") {
        return e.status === EntryStatus.Left || e.status === EntryStatus.Removed;
      }
      return true;
    });
  }, [entriesWithPosition, entryFilter]);

  if (!isConnected) {
    return (
      <section className="page-section">
        <div className="empty-card">
          <ShieldAlert size={28} className="empty-icon" />
          <h3>Connect Organiser Wallet</h3>
          <p>
            Connect the wallet you used to create a waitlist to call next
            participants, admit users, remove entries, or close queues.
          </p>
        </div>
      </section>
    );
  }

  if (ownedWaitlists.length === 0) {
    return (
      <section className="page-section">
        <div className="empty-card">
          <h3>No Waitlists Owned by {shortenAddress(address!)}</h3>
          <p>
            Create a waitlist first to manage its queue, admit participants, and
            monitor active capacity.
          </p>
          <button type="button" className="btn-primary" onClick={onGoCreate}>
            Create Waitlist
          </button>
        </div>
      </section>
    );
  }

  if (!activeWaitlist) return null;

  const isCalling = pendingActionKey === `call-${activeWaitlist.id.toString()}`;
  const isClosing = pendingActionKey === `close-${activeWaitlist.id.toString()}`;
  const capacityPct =
    activeWaitlist.maxCapacity > 0
      ? Math.min(
          100,
          Math.round(
            (activeWaitlist.activeCount / activeWaitlist.maxCapacity) * 100
          )
        )
      : 0;

  return (
    <section className="page-section">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Organiser Console</span>
          <h2>Manage Your Queues</h2>
        </div>

        <div className="selector-row">
          <label htmlFor="waitlist-selector" className="muted-label">
            Active Waitlist:
          </label>
          <select
            id="waitlist-selector"
            className="select-input"
            value={activeWaitlist.id.toString()}
            onChange={(e) => onSelectWaitlist(BigInt(e.target.value))}
          >
            {ownedWaitlists.map((w) => (
              <option key={w.id.toString()} value={w.id.toString()}>
                #{w.id.toString()} · {w.name} ({w.activeCount}/{w.maxCapacity})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              refetchWaitlists();
              refetchEntries();
            }}
            title="Refresh dashboard"
          >
            <RefreshCw size={15} className={isFetchingEntries ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="card control-panel">
        <div className="control-top">
          <div>
            <div className="card-meta-row">
              <span className="id-chip">#{activeWaitlist.id.toString()}</span>
              <span
                className={`status-badge ${
                  activeWaitlist.isOpen ? "open" : "closed"
                }`}
              >
                {activeWaitlist.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <h3>{activeWaitlist.name}</h3>
          </div>

          <div className="control-buttons">
            <button
              type="button"
              className="btn-primary"
              disabled={
                activeWaitlist.waitingCount === 0 || Boolean(pendingActionKey)
              }
              onClick={() => onCallNext(activeWaitlist.id)}
            >
              <BellRing size={16} />
              <span>
                {isCalling
                  ? "Calling..."
                  : `Call Next (${activeWaitlist.waitingCount})`}
              </span>
            </button>

            <button
              type="button"
              className="btn-secondary-danger"
              disabled={!activeWaitlist.isOpen || Boolean(pendingActionKey)}
              onClick={() => onCloseWaitlist(activeWaitlist.id)}
            >
              <Lock size={16} />
              <span>
                {!activeWaitlist.isOpen
                  ? "Waitlist Closed"
                  : isClosing
                  ? "Closing..."
                  : "Close Waitlist"}
              </span>
            </button>
          </div>
        </div>

        <div className="capacity-block">
          <div className="capacity-header">
            <span>Active Capacity (Waiting + Called + Admitted)</span>
            <span className="mono-value">
              {activeWaitlist.activeCount} / {activeWaitlist.maxCapacity} spots (
              {capacityPct}%)
            </span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${
                activeWaitlist.activeCount >= activeWaitlist.maxCapacity
                  ? "full"
                  : ""
              }`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-pill">
            <span>Waiting</span>
            <strong>{activeWaitlist.waitingCount}</strong>
          </div>
          <div className="stat-pill">
            <span>Called</span>
            <strong>{activeWaitlist.calledCount}</strong>
          </div>
          <div className="stat-pill">
            <span>Admitted</span>
            <strong>{activeWaitlist.admittedCount}</strong>
          </div>
          <div className="stat-pill">
            <span>Total Entries (incl. history)</span>
            <strong>{activeWaitlist.totalEntries}</strong>
          </div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-header">
          <h3>Participant List & Historical Entries</h3>
          <div className="filter-group">
            {(
              [
                ["all", "All"],
                ["waiting", "Waiting"],
                ["called", "Called"],
                ["admitted", "Admitted"],
                ["inactive", "Left / Removed"],
              ] as [EntryFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-chip ${entryFilter === key ? "active" : ""}`}
                onClick={() => setEntryFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="table-empty">
            No participant entries match this filter yet.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="entries-table">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Wallet</th>
                  <th>Queue Pos</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const canAdmit =
                    entry.status === EntryStatus.Waiting ||
                    entry.status === EntryStatus.Called;
                  const canRemove =
                    entry.status === EntryStatus.Waiting ||
                    entry.status === EntryStatus.Called ||
                    entry.status === EntryStatus.Admitted;
                  const admittingThis =
                    pendingActionKey ===
                    `admit-${activeWaitlist.id.toString()}-${entry.wallet}`;
                  const removingThis =
                    pendingActionKey ===
                    `remove-${activeWaitlist.id.toString()}-${entry.wallet}`;

                  return (
                    <tr key={entry.entryId}>
                      <td className="mono-value">#{entry.entryId}</td>
                      <td>
                        <a
                          href={addressExplorerUrl(entry.wallet)}
                          target="_blank"
                          rel="noreferrer"
                          className="mono-link"
                        >
                          {shortenAddress(entry.wallet, 6)}{" "}
                          <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="mono-value">
                        {entry.queuePos !== null ? `#${entry.queuePos}` : "—"}
                      </td>
                      <td>
                        <span className={`entry-badge status-${entry.status}`}>
                          {STATUS_LABELS[entry.status]}
                        </span>
                      </td>
                      <td className="align-right">
                        <div className="row-actions">
                          {canAdmit && (
                            <button
                              type="button"
                              className="btn-table-admit"
                              disabled={Boolean(pendingActionKey)}
                              onClick={() =>
                                onAdmitUser(activeWaitlist.id, entry.wallet)
                              }
                            >
                              <Check size={14} />
                              <span>{admittingThis ? "..." : "Admit"}</span>
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              className="btn-table-remove"
                              disabled={Boolean(pendingActionKey)}
                              onClick={() =>
                                onRemoveUser(activeWaitlist.id, entry.wallet)
                              }
                            >
                              <UserX size={14} />
                              <span>{removingThis ? "..." : "Remove"}</span>
                            </button>
                          )}
                          {!canAdmit && !canRemove && (
                            <span className="historical-tag">
                              Historical Record
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

