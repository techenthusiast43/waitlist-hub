import { CheckCircle2, AlertCircle, Loader2, ExternalLink, X } from "lucide-react";
import { shortenAddress, txExplorerUrl } from "../config/chain";

export interface TxNotification {
  id: string;
  kind: "loading" | "success" | "error";
  title: string;
  message: string;
  txHash?: string;
}

interface ToastContainerProps {
  items: TxNotification[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ items, onDismiss }: ToastContainerProps) {
  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.kind}`}>
          <div className="toast-icon">
            {item.kind === "loading" && <Loader2 size={18} className="spin" />}
            {item.kind === "success" && <CheckCircle2 size={18} />}
            {item.kind === "error" && <AlertCircle size={18} />}
          </div>
          <div className="toast-body">
            <div className="toast-title">{item.title}</div>
            <div className="toast-message">{item.message}</div>
            {item.txHash && (
              <a
                href={txExplorerUrl(item.txHash)}
                target="_blank"
                rel="noreferrer"
                className="toast-link"
              >
                Tx {shortenAddress(item.txHash, 6)} <ExternalLink size={12} />
              </a>
            )}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

