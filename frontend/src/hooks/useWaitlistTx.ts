import { useCallback, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { BOT_CHAIN_TESTNET_ID } from "../config/chain";
import {
  WAITLIST_HUB_ABI,
  WAITLIST_HUB_ADDRESS,
  parseContractError,
} from "../contracts/waitlistHub";
import type { TxNotification } from "../components/ToastContainer";

export interface TxHistoryItem {
  hash: string;
  label: string;
  status: "pending" | "success" | "failed";
  timestamp: number;
}

export function useWaitlistTx() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: BOT_CHAIN_TESTNET_ID });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState<TxNotification[]>([]);
  const [recentTxs, setRecentTxs] = useState<TxHistoryItem[]>([]);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const upsertToast = useCallback((toast: TxNotification) => {
    setNotifications((prev) => {
      const exists = prev.some((item) => item.id === toast.id);
      if (exists) {
        return prev.map((item) => (item.id === toast.id ? toast : item));
      }
      return [toast, ...prev.slice(0, 4)];
    });
    if (toast.kind !== "loading") {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== toast.id));
      }, 8000);
    }
  }, []);

  const executeTx = useCallback(
    async (
      actionKey: string,
      label: string,
      functionName:
        | "createWaitlist"
        | "joinWaitlist"
        | "leaveWaitlist"
        | "callNext"
        | "admitUser"
        | "removeUser"
        | "closeWaitlist",
      args: readonly unknown[],
      onConfirmed?: () => void
    ): Promise<boolean> => {
      if (!WAITLIST_HUB_ADDRESS) {
        upsertToast({
          id: `${Date.now()}`,
          kind: "error",
          title: "Contract Not Configured",
          message:
            "Set VITE_WAITLIST_HUB_ADDRESS in .env before sending transactions.",
        });
        return false;
      }

      if (!isConnected || !address) {
        upsertToast({
          id: `${Date.now()}`,
          kind: "error",
          title: "Wallet Required",
          message: "Connect your wallet to submit transactions on BOT Chain Testnet.",
        });
        return false;
      }

      const toastId = `${actionKey}-${Date.now()}`;
      setPendingActionKey(actionKey);

      try {
        if (chainId !== BOT_CHAIN_TESTNET_ID) {
          upsertToast({
            id: toastId,
            kind: "loading",
            title: "Switching Network",
            message: "Switching wallet to BOT Chain Testnet (968)...",
          });
          await switchChainAsync({ chainId: BOT_CHAIN_TESTNET_ID });
        }

        upsertToast({
          id: toastId,
          kind: "loading",
          title: label,
          message: "Confirm transaction in your wallet...",
        });

        const hash = await writeContractAsync({
          address: WAITLIST_HUB_ADDRESS,
          abi: WAITLIST_HUB_ABI,
          functionName,
          args: args as never,
          chainId: BOT_CHAIN_TESTNET_ID,
        });

        setRecentTxs((prev) => [
          { hash, label, status: "pending", timestamp: Date.now() },
          ...prev.slice(0, 9),
        ]);

        upsertToast({
          id: toastId,
          kind: "loading",
          title: `${label} Submitted`,
          message: "Waiting for BOT Chain confirmation...",
          txHash: hash,
        });

        if (!publicClient) {
          throw new Error("Public RPC client unavailable for BOT Chain Testnet.");
        }

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status !== "success") {
          setRecentTxs((prev) =>
            prev.map((tx) =>
              tx.hash === hash ? { ...tx, status: "failed" } : tx
            )
          );
          upsertToast({
            id: toastId,
            kind: "error",
            title: `${label} Reverted`,
            message: "Transaction reverted on BOT Chain Testnet.",
            txHash: hash,
          });
          return false;
        }

        setRecentTxs((prev) =>
          prev.map((tx) =>
            tx.hash === hash ? { ...tx, status: "success" } : tx
          )
        );

        upsertToast({
          id: toastId,
          kind: "success",
          title: `${label} Confirmed`,
          message: "State updated on BOT Chain Testnet.",
          txHash: hash,
        });

        await queryClient.invalidateQueries();
        onConfirmed?.();
        return true;
      } catch (err) {
        const message = parseContractError(err);
        upsertToast({
          id: toastId,
          kind: "error",
          title: `${label} Failed`,
          message,
        });
        return false;
      } finally {
        setPendingActionKey(null);
      }
    },
    [
      address,
      chainId,
      isConnected,
      publicClient,
      queryClient,
      switchChainAsync,
      upsertToast,
      writeContractAsync,
    ]
  );

  return {
    notifications,
    recentTxs,
    pendingActionKey,
    dismissNotification,
    executeTx,
  };
}
