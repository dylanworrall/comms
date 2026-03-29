import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const USERS_FILE = join(DATA_DIR, "auth-users.json");
const SESSIONS_FILE = join(DATA_DIR, "auth-sessions.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// ─── User ───

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: "free" | "pro" | "business";
  messageCount: number;
  periodStart: string;
  whopMembershipId?: string;
  // Per-user phone numbers
  voiceNumber?: string; // Twilio local number for calls
  smsNumber?: string; // Twilio toll-free number for SMS
  smsNumberSid?: string; // Twilio SID for the SMS number
  smsVerificationSid?: string; // Toll-free verification SID
  smsVerificationStatus?: string;
  createdAt: string;
}

function getUsers(): AuthUser[] {
  try { return JSON.parse(readFileSync(USERS_FILE, "utf-8")); } catch { return []; }
}

function saveUsers(users: AuthUser[]): void {
  ensureDir();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function findUserByEmail(email: string): AuthUser | null {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findUserById(id: string): AuthUser | null {
  return getUsers().find((u) => u.id === id) ?? null;
}

export async function createUser(email: string, password: string, name: string): Promise<AuthUser> {
  const users = getUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("User already exists");
  }
  const user: AuthUser = {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    passwordHash: await bcrypt.hash(password, 10),
    plan: "free",
    messageCount: 0,
    periodStart: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export async function verifyPassword(email: string, password: string): Promise<AuthUser | null> {
  const user = findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export function updateUser(id: string, updates: Partial<Omit<AuthUser, "id" | "createdAt">>): AuthUser | null {
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, updates);
  saveUsers(users);
  return user;
}

/** Check + deduct a message. Returns { allowed, remaining } */
export function useMessage(userId: string): { allowed: boolean; remaining: number } {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { allowed: false, remaining: 0 };

  const TIER_LIMITS: Record<string, number> = { free: 3, pro: 1000, business: 5000 };
  const limit = TIER_LIMITS[user.plan] ?? 3;

  // Reset period if 30+ days
  const daysSince = (Date.now() - new Date(user.periodStart).getTime()) / 86400000;
  if (daysSince >= 30) {
    user.messageCount = 0;
    user.periodStart = new Date().toISOString();
  }

  if (user.messageCount >= limit) {
    saveUsers(users);
    return { allowed: false, remaining: 0 };
  }

  user.messageCount++;
  saveUsers(users);
  return { allowed: true, remaining: limit - user.messageCount };
}

// ─── Sessions ───

interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

function getSessions(): Session[] {
  try { return JSON.parse(readFileSync(SESSIONS_FILE, "utf-8")); } catch { return []; }
}

function saveSessions(sessions: Session[]): void {
  ensureDir();
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

export function createSession(userId: string): string {
  const sessions = getSessions();
  // Clean expired sessions
  const now = Date.now();
  const active = sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  const token = randomUUID();
  active.push({
    id: token,
    userId,
    expiresAt: new Date(now + 30 * 86400000).toISOString(), // 30 days
  });
  saveSessions(active);
  return token;
}

export function validateSession(token: string): AuthUser | null {
  if (!token) return null;
  const sessions = getSessions();
  const session = sessions.find((s) => s.id === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return findUserById(session.userId);
}

export function deleteSession(token: string): void {
  const sessions = getSessions().filter((s) => s.id !== token);
  saveSessions(sessions);
}
