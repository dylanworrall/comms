import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ActivityEntry {
  id: string;
  type: "email_sent" | "email_received" | "contact_added" | "approval_resolved" | "call_placed" | "call_initiated" | "call_answered" | "call_ended" | "call_recording_saved";
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "activity.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): ActivityEntry[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

function saveAll(items: ActivityEntry[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export function addActivity(
  type: ActivityEntry["type"],
  summary: string,
  metadata?: Record<string, unknown>
): ActivityEntry {
  const items = getAll();
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    type,
    summary,
    timestamp: new Date().toISOString(),
    metadata,
  };
  items.unshift(entry);
  saveAll(items);
  return entry;
}

export function getActivity(limit = 20): ActivityEntry[] {
  return getAll().slice(0, limit);
}
