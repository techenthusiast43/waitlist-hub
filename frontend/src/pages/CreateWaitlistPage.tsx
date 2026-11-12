import { useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import { PlusCircle, ShieldCheck, Info } from "lucide-react";

interface CreateWaitlistPageProps {
  pendingActionKey: string | null;
  onCreate: (name: string, maxCapacity: number) => Promise<boolean>;
  onSuccessRedirect: () => void;
}

export function CreateWaitlistPage({
  pendingActionKey,
  onCreate,
  onSuccessRedirect,
}: CreateWaitlistPageProps) {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("25");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isCreating = pendingActionKey === "create-waitlist";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const trimmed = name.trim();
    const byteLength = new TextEncoder().encode(trimmed).length;
    if (!trimmed) {
      setValidationError("Please enter a waitlist name.");
      return;
    }
    if (byteLength > 128) {
      setValidationError("Waitlist name must be 128 bytes or fewer.");
      return;
    }

    const parsedCap = Number(capacity);
    if (!Number.isInteger(parsedCap) || parsedCap < 1 || parsedCap > 4_294_967_295) {
      setValidationError("Maximum capacity must be a positive whole number.");
      return;
    }

    const ok = await onCreate(trimmed, parsedCap);
    if (ok) {
      setName("");
      setCapacity("25");
      onSuccessRedirect();
    }
  }

  return (
    <section className="page-section create-page-wrap">
      <div className="create-grid">
        <div className="card create-card">
          <div className="section-heading">
            <span className="eyebrow">Organiser Launchpad</span>
            <h2>Create a Waitlist</h2>
            <p className="muted-copy">
              Deploy a new on-chain FCFS queue on BOT Chain Testnet. Your
              connected wallet becomes the waitlist organiser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            <div className="form-field">
              <label htmlFor="waitlist-name">Waitlist Name</label>
              <input
                id="waitlist-name"
                type="text"
                maxLength={128}
                placeholder="e.g. BOT AI Summit VIP Access"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                required
              />
              <span className="field-hint">
                Up to 128 bytes. Displayed publicly in Browse Waitlists.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="waitlist-capacity">Maximum Active Capacity</label>
              <input
                id="waitlist-capacity"
                type="number"
                min={1}
                step={1}
                placeholder="25"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                disabled={isCreating}
                required
              />
              <span className="field-hint">
                Counts active participants (Waiting, Called, Admitted). Left and
                Removed entries free up spots immediately.
              </span>
            </div>

            {validationError && (
              <div className="inline-error">{validationError}</div>
            )}

            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={!isConnected || Boolean(pendingActionKey)}
            >
              <PlusCircle size={17} />
              <span>
                {!isConnected
                  ? "Connect Wallet to Create"
                  : isCreating
                  ? "Creating Waitlist..."
                  : "Create Waitlist On-Chain"}
              </span>
            </button>
          </form>
        </div>

        <aside className="card info-card">
          <div className="info-header">
            <ShieldCheck size={18} />
            <h3>Smart Contract Queue Rules</h3>
          </div>
          <ul className="rules-list">
            <li>
              <strong>Strict FCFS Order:</strong> Participants receive queue
              positions based on transaction confirmation order.
            </li>
            <li>
              <strong>Active Capacity:</strong> Only <code>Waiting</code>,{" "}
              <code>Called</code>, and <code>Admitted</code> participants count
              toward capacity.
            </li>
            <li>
              <strong>Instant Spot Release:</strong> If a user leaves or is
              removed, a capacity slot becomes available right away.
            </li>
            <li>
              <strong>Controlled Re-joining:</strong> Users who leave
              voluntarily may rejoin at the back of the queue with a new entry
              ID. Organiser-removed users cannot rejoin.
            </li>
            <li>
              <strong>No Token Fees:</strong> Pure gas-efficient queue
              management on BOT Chain Testnet (Chain ID 968).
            </li>
          </ul>
          <div className="info-footer">
            <Info size={14} />
            <span>
              Only your organiser wallet can call next, admit, remove
              participants, or close this waitlist.
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

