import { BaseError, ContractFunctionRevertedError, isAddress, type Address } from "viem";

export const DEFAULT_WAITLIST_HUB_ADDRESS: Address =
  "0xe770F12345792e325C32BF3D834EaAEaC701b51A";

export const rawContractAddress = (
  import.meta.env.VITE_WAITLIST_HUB_ADDRESS || DEFAULT_WAITLIST_HUB_ADDRESS
).trim();

export const WAITLIST_HUB_ADDRESS: Address | null = isAddress(rawContractAddress)
  ? rawContractAddress
  : null;

export enum EntryStatus {
  None = 0,
  Waiting = 1,
  Called = 2,
  Admitted = 3,
  Left = 4,
  Removed = 5,
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  [EntryStatus.None]: "Not Joined",
  [EntryStatus.Waiting]: "Waiting",
  [EntryStatus.Called]: "Called",
  [EntryStatus.Admitted]: "Admitted",
  [EntryStatus.Left]: "Left",
  [EntryStatus.Removed]: "Removed",
};

export interface WaitlistData {
  id: bigint;
  organiser: Address;
  name: string;
  isOpen: boolean;
  maxCapacity: number;
  activeCount: number;
  waitingCount: number;
  calledCount: number;
  admittedCount: number;
  totalEntries: number;
}

export interface WaitlistEntryData {
  entryId: number;
  wallet: Address;
  status: EntryStatus;
}

export const WAITLIST_HUB_ABI = [
  {
    type: "error",
    name: "AlreadyActiveOrAdmitted",
    inputs: [],
  },
  {
    type: "error",
    name: "CannotAdmitUser",
    inputs: [{ name: "currentStatus", type: "uint8" }],
  },
  {
    type: "error",
    name: "CannotLeaveAfterAdmissionOrExit",
    inputs: [{ name: "currentStatus", type: "uint8" }],
  },
  {
    type: "error",
    name: "CannotRemoveUser",
    inputs: [{ name: "currentStatus", type: "uint8" }],
  },
  {
    type: "error",
    name: "EmptyName",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidCapacity",
    inputs: [],
  },
  {
    type: "error",
    name: "NameTooLong",
    inputs: [],
  },
  {
    type: "error",
    name: "NoWaitingParticipants",
    inputs: [],
  },
  {
    type: "error",
    name: "NotInWaitlist",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOrganiser",
    inputs: [],
  },
  {
    type: "error",
    name: "RemovedUserCannotRejoin",
    inputs: [],
  },
  {
    type: "error",
    name: "UserNotInWaitlist",
    inputs: [],
  },
  {
    type: "error",
    name: "WaitlistAlreadyClosed",
    inputs: [],
  },
  {
    type: "error",
    name: "WaitlistFull",
    inputs: [],
  },
  {
    type: "error",
    name: "WaitlistIsClosed",
    inputs: [],
  },
  {
    type: "error",
    name: "WaitlistNotFound",
    inputs: [],
  },
  {
    type: "event",
    name: "WaitlistCreated",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "organiser", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "maxCapacity", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UserJoined",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "isRejoin", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UserRejoined",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "previousEntryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UserLeft",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UserCalled",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UserAdmitted",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UserRemoved",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "entryId", type: "uint32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "previousStatus", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WaitlistClosed",
    inputs: [
      { name: "waitlistId", type: "uint256", indexed: true },
      { name: "organiser", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "waitlistCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createWaitlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "maxCapacity", type: "uint256" },
    ],
    outputs: [{ name: "waitlistId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinWaitlist",
    stateMutability: "nonpayable",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "leaveWaitlist",
    stateMutability: "nonpayable",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "callNext",
    stateMutability: "nonpayable",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [
      { name: "entryId", type: "uint256" },
      { name: "participant", type: "address" },
    ],
  },
  {
    type: "function",
    name: "admitUser",
    stateMutability: "nonpayable",
    inputs: [
      { name: "waitlistId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removeUser",
    stateMutability: "nonpayable",
    inputs: [
      { name: "waitlistId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeWaitlist",
    stateMutability: "nonpayable",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getWaitlist",
    stateMutability: "view",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "organiser", type: "address" },
          { name: "name", type: "string" },
          { name: "isOpen", type: "bool" },
          { name: "maxCapacity", type: "uint32" },
          { name: "activeCount", type: "uint32" },
          { name: "waitingCount", type: "uint32" },
          { name: "calledCount", type: "uint32" },
          { name: "admittedCount", type: "uint32" },
          { name: "totalEntries", type: "uint32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getMyPosition",
    stateMutability: "view",
    inputs: [{ name: "waitlistId", type: "uint256" }],
    outputs: [
      { name: "position", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "entryId", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "getUserPosition",
    stateMutability: "view",
    inputs: [
      { name: "waitlistId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "position", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "entryId", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "getWaitlists",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "items",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "organiser", type: "address" },
          { name: "name", type: "string" },
          { name: "isOpen", type: "bool" },
          { name: "maxCapacity", type: "uint32" },
          { name: "activeCount", type: "uint32" },
          { name: "waitingCount", type: "uint32" },
          { name: "calledCount", type: "uint32" },
          { name: "admittedCount", type: "uint32" },
          { name: "totalEntries", type: "uint32" },
        ],
      },
      { name: "total", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getWaitlistEntries",
    stateMutability: "view",
    inputs: [
      { name: "waitlistId", type: "uint256" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "items",
        type: "tuple[]",
        components: [
          { name: "entryId", type: "uint32" },
          { name: "wallet", type: "address" },
          { name: "status", type: "uint8" },
        ],
      },
      { name: "totalEntries", type: "uint32" },
    ],
  },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  EmptyName: "Waitlist name cannot be empty.",
  NameTooLong: "Waitlist name cannot exceed 128 bytes.",
  InvalidCapacity: "Capacity must be at least 1.",
  WaitlistNotFound: "Waitlist not found on-chain.",
  NotOrganiser: "Only the waitlist organiser can perform this action.",
  WaitlistIsClosed: "This waitlist is closed to new joins.",
  WaitlistAlreadyClosed: "This waitlist is already closed.",
  WaitlistFull: "Waitlist is currently at maximum active capacity.",
  AlreadyActiveOrAdmitted:
    "Your wallet is already active or admitted on this waitlist.",
  RemovedUserCannotRejoin:
    "Your wallet was removed by the organiser and cannot rejoin.",
  NotInWaitlist: "Your wallet has no entry in this waitlist.",
  CannotLeaveAfterAdmissionOrExit:
    "You can only leave while Waiting or Called (before admission).",
  NoWaitingParticipants: "There are no Waiting participants to call.",
  UserNotInWaitlist: "Participant has no entry in this waitlist.",
  CannotAdmitUser:
    "Only Waiting or Called participants can be admitted (already admitted, left, or removed users are blocked).",
  CannotRemoveUser:
    "Participants already marked Left or Removed cannot be removed.",
};

export function parseContractError(err: unknown): string {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (errorName && ERROR_MESSAGES[errorName]) {
        return ERROR_MESSAGES[errorName];
      }
    }
    if (err.shortMessage) {
      return err.shortMessage;
    }
  }
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("user rejected")) {
      return "Transaction signature rejected in wallet.";
    }
    return err.message;
  }
  return "Transaction failed. Please try again.";
}

