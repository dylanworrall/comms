import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ApprovalItem {
  id: string;
  type: "send_email" | "reply_to_email" | "initiate_call" | "add_contact" | "update_contact";
  status: "pending" | "approved" | "rejected";
  data: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "approvals.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): ApprovalItem[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as ApprovalItem[];
  } catch {
    return [];
  }
}

function saveAll(items: ApprovalItem[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export function createApproval(
  type: ApprovalItem["type"],
  data: Record<string, unknown>
): ApprovalItem {
  const items = getAll();
  const item: ApprovalItem = {
    id: crypto.randomUUID(),
    type,
    status: "pending",
    data,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  saveAll(items);
  return item;
}

export function getApprovals(status?: ApprovalItem["status"]): ApprovalItem[] {
  const items = getAll();
  if (status) return items.filter((a) => a.status === status);
  return items;
}

export function resolveApproval(
  id: string,
  resolution: "approved" | "rejected"
): ApprovalItem | null {
  const items = getAll();
  const item = items.find((a) => a.id === id);
  if (!item || item.status !== "pending") return null;
  item.status = resolution;
  item.resolvedAt = new Date().toISOString();
  saveAll(items);
  return item;
}

export function getApprovalById(id: string): ApprovalItem | null {
  return getAll().find((a) => a.id === id) ?? null;
}
