import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CallRecord {
  id: string;
  contactId?: string;
  contactName: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail";
  duration: number;
  timestamp: string;
  transcript?: string;
  notes?: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "calls.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): CallRecord[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as CallRecord[];
  } catch {
    return [];
  }
}

function saveAll(items: CallRecord[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

const SEED_CALLS: Omit<CallRecord, "id">[] = [
  {
    contactName: "Sarah Chen",
    phoneNumber: "+1-415-555-0142",
    direction: "outbound",
    status: "completed",
    duration: 847,
    timestamp: "2026-03-04T14:30:00.000Z",
    transcript: "Discussed Q2 strategy timeline and deliverables. Sarah confirmed the Thursday meeting and will send updated deck by Wednesday EOD.",
    notes: "Follow up on partnership pipeline numbers before Thursday.",
  },
  {
    contactName: "James Wright",
    phoneNumber: "+1-212-555-0198",
    direction: "inbound",
    status: "missed",
    duration: 0,
    timestamp: "2026-03-04T11:15:00.000Z",
    notes: "Missed call — likely about the AI integration proposal. Need to call back.",
  },
  {
    contactName: "Unknown Caller",
    phoneNumber: "+1-800-555-0176",
    direction: "inbound",
    status: "voicemail",
    duration: 32,
    timestamp: "2026-03-03T17:45:00.000Z",
    transcript: "Hi, this is Rachel from CloudSync. We spoke at the conference last month. Wanted to follow up on the demo you requested. Please call me back at this number. Thanks!",
  },
];

function seedIfEmpty(): CallRecord[] {
  let calls = getAll();
  if (calls.length === 0) {
    calls = SEED_CALLS.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    saveAll(calls);
  }
  return calls;
}

export function getAllCalls(): CallRecord[] {
  return seedIfEmpty();
}

export function getCallById(id: string): CallRecord | null {
  return seedIfEmpty().find((c) => c.id === id) ?? null;
}

export function getCalls(opts: {
  limit?: number;
  direction?: CallRecord["direction"];
  contactName?: string;
}): CallRecord[] {
  let calls = seedIfEmpty();

  if (opts.direction) {
    calls = calls.filter((c) => c.direction === opts.direction);
  }
  if (opts.contactName) {
    const q = opts.contactName.toLowerCase();
    calls = calls.filter((c) => c.contactName.toLowerCase().includes(q));
  }

  // Sort newest first
  calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (opts.limit) {
    calls = calls.slice(0, opts.limit);
  }

  return calls;
}

export function addCall(
  data: Omit<CallRecord, "id">
): CallRecord {
  const calls = seedIfEmpty();
  const call: CallRecord = {
    ...data,
    id: crypto.randomUUID(),
  };
  calls.push(call);
  saveAll(calls);
  return call;
}

export function updateCallNotes(id: string, notes: string): CallRecord | null {
  const calls = seedIfEmpty();
  const call = calls.find((c) => c.id === id);
  if (!call) return null;
  call.notes = notes;
  saveAll(calls);
  return call;
}
