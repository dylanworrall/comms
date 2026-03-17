import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface GmailAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

const COMMS_DIR = join(homedir(), ".comms");
const FILE_PATH = join(COMMS_DIR, "gmail-tokens.json");

function ensureDir() {
  if (!existsSync(COMMS_DIR)) mkdirSync(COMMS_DIR, { recursive: true });
}

function getAll(): GmailAccount[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as GmailAccount[];
  } catch {
    return [];
  }
}

function saveAll(accounts: GmailAccount[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(accounts, null, 2), "utf-8");
}

export function getGmailAccounts(): GmailAccount[] {
  return getAll();
}

export function getGmailAccount(email: string): GmailAccount | null {
  return getAll().find((a) => a.email === email) ?? null;
}

export function saveGmailAccount(account: GmailAccount): void {
  const accounts = getAll();
  const idx = accounts.findIndex((a) => a.email === account.email);
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  saveAll(accounts);
}

export function removeGmailAccount(email: string): boolean {
  const accounts = getAll();
  const idx = accounts.findIndex((a) => a.email === email);
  if (idx === -1) return false;
  accounts.splice(idx, 1);
  saveAll(accounts);
  return true;
}

export function getDefaultGmailAccount(): GmailAccount | null {
  const accounts = getAll();
  if (accounts.length === 0) return null;

  // If GOG_ACCOUNT env var is set, try to match it
  const envAccount = process.env.GOG_ACCOUNT;
  if (envAccount) {
    const match = accounts.find((a) => a.email === envAccount);
    if (match) return match;
  }

  // Otherwise return first account
  return accounts[0];
}
