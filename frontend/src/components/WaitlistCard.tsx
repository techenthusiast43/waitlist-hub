import { useAccount, useReadContract } from "wagmi";
import {
  Users,
  Clock,
  CheckCircle2,
  LogOut,
  ArrowRight,
  ExternalLink,
  Ban,
  ShieldCheck,
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
} from "../contracts/waitlistHub";

interface WaitlistCardProps {
  waitlist: WaitlistData;
  pendingActionKey: string | null;
  onJoin: (waitlistId: bigint) => void;
  onLeave: (waitlistId: bigint) => void;
  onManage: (waitlistId: bigint) => void;
}

export function WaitlistCard({
  waitlist,
  pendingActionKey,
  onJoin,
  onLeave,
  onManage,
}: WaitlistCardProps) {
  const { address, isConnected } = useAccount();

  const { data: positionData } = useReadContract({
    address: WAITLIST_HUB_ADDRESS ?? undefined,
    abi: WAITLIST_HUB_ABI,
    functionName: "getMyPosition",
    args: [waitlist.id],
    account: address,
    chainId: BOT_CHAIN_TESTNET_ID,
    query: {
      enabled: Boolean(WAITLIST_HUB_ADDRESS && isConnected && address),
      refetchInterval: 10_000,
    },
  });

  const queuePosition = positionData ? Number(positionData[0]) : 0;
  const userStatus: EntryStatus = positionData
    ? (Number(positionData[1]) as EntryStatus)
    : EntryStatus.None;
  const userEntryId = positionData ? Number(positionData[2]) : 0;

  const isOrganiser =
    Boolean(address) &&
    address!.toLowerCase() === waitlist.organiser.toLowerCase();

  const isFull = waitlist.activeCount >= waitlist.maxCapacity;
  const capacityPct =
    waitlist.maxCapacity > 0
      ? Math.min(100, Math.round((waitlist.activeCount / waitlist.maxCapacity) * 100))
      : 0;

  const canJoin =
    waitlist.isOpen &&
    !isFull &&
    (userStatus === EntryStatus.None || userStatus === EntryStatus.Left);

  const canLeave =
    userStatus === EntryStatus.Waiting || userStatus === EntryStatus.Called;

  const isJoining = pendingActionKey === `join-${waitlist.id.toString()}`;
  const isLeaving = pendingActionKey === `leave-${waitlist.id.toString()}`;

  return (
    <article className="card waitlist-card">
      <div className="card-header">
        <div>
          <div className="card-meta-row">
            <span className="id-chip">#{waitlist.id.toString()}</span>
            {isOrganiser && (
              <span className="owner-chip">
                <ShieldCheck size={12} /> Organiser
              </span>
            )}
          </div>
          <h3 className="card-title">{waitlist.name}</h3>
        </div>

        <span
          className={`status-badge ${
            !waitlist.isOpen ? "closed" : isFull ? "full" : "open"
          }`}
        >
          {!waitlist.isOpen ? "Closed" : isFull ? "Full" : "Open"}
        </span>
      </div>

      <div className="organiser-row">
        <span className="muted-label">Organiser</span>
        <a
          href={addressExplorerUrl(waitlist.organiser)}
          target="_blank"
          rel="noreferrer"
          className="mono-link"
        >
          {shortenAddress(waitlist.organiser)} <ExternalLink size={12} />
        </a>
      </div>

      <div className="capacity-block">
        <div className="capacity-header">
          <span>Active Capacity</span>
          <span className="mono-value">
            {waitlist.activeCount} / {waitlist.maxCapacity} spots ({capacityPct}%)
          </span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${isFull ? "full" : ""}`}
            style={{ width: `${capacityPct}%` }}
          />
        </div>
      </div>

      <div className="mini-stats">
        <div className="mini-stat">
          <Clock size={14} />
          <span>{waitlist.waitingCount} Waiting</span>
        </div>
        <div className="mini-stat">
          <Users size={14} />
          <span>{waitlist.calledCount} Called</span>
        </div>
        <div className="mini-stat">
          <CheckCircle2 size={14} />
          <span>{waitlist.admittedCount} Admitted</span>
        </div>
      </div>

      {isConnected && userStatus !== EntryStatus.None && (
        <div className={`position-banner status-${userStatus}`}>
          <div className="position-banner-main">
            <span className="position-banner-label">
              Your Entry #{userEntryId} · {STATUS_LABELS[userStatus]}
            </span>
            {userStatus === EntryStatus.Waiting && (
              <strong className="position-number">
                Position #{queuePosition}
                {queuePosition === 1 ? " (Next Up)" : ""}
              </strong>
            )}
            {userStatus === EntryStatus.Called && (
              <strong className="position-call">You have been called!</strong>
            )}
            {userStatus === EntryStatus.Admitted && (
              <strong className="position-admitted">Admitted to event</strong>
            )}
            {userStatus === EntryStatus.Left && (
              <span className="position-note">
                Spot released — you may rejoin at back of queue
              </span>
            )}
            {userStatus === EntryStatus.Removed && (
              <span className="position-note">
                <Ban size={13} /> Removed by organiser (rejoin disabled)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card-actions">
        {isConnected ? (
          <>
            {canJoin && (
              <button
                type="button"
                className="btn-primary"
                disabled={Boolean(pendingActionKey)}
                onClick={() => onJoin(waitlist.id)}
              >
                <span>
                  {isJoining
                    ? "Submitting..."
                    : userStatus === EntryStatus.Left
                    ? "Rejoin Waitlist"
                    : "Join Waitlist"}
                </span>
                <ArrowRight size={15} />
              </button>
            )}

            {canLeave && (
              <button
                type="button"
                className="btn-secondary-danger"
                disabled={Boolean(pendingActionKey)}
                onClick={() => onLeave(waitlist.id)}
              >
                <LogOut size={15} />
                <span>{isLeaving ? "Leaving..." : "Leave Waitlist"}</span>
              </button>
            )}

            {!canJoin && !canLeave && userStatus === EntryStatus.None && (
              <button type="button" className="btn-disabled" disabled>
                {!waitlist.isOpen ? "Waitlist Closed" : "Waitlist Full"}
              </button>
            )}

            {isOrganiser && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => onManage(waitlist.id)}
              >
                Manage
              </button>
            )}
          </>
        ) : (
          <div className="connect-hint">
            Connect wallet to join or check your position
          </div>
        )}
      </div>
    </article>
  );
}

