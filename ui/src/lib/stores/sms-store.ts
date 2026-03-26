import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SmsMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: "inbound" | "outbound";
  status: "sent" | "delivered" | "failed" | "received";
  timestamp: string;
  twilioSid?: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "sms.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): SmsMessage[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as SmsMessage[];
  } catch {
    return [];
  }
}

function saveAll(msgs: SmsMessage[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(msgs, null, 2), "utf-8");
}

export function getAllSms(): SmsMessage[] {
  return getAll().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getSmsConversation(phoneNumber: string): SmsMessage[] {
  const normalized = phoneNumber.replace(/\D/g, "");
  return getAll()
    .filter((m) => {
      const from = m.from.replace(/\D/g, "");
      const to = m.to.replace(/\D/g, "");
      return from === normalized || to === normalized || from.endsWith(normalized) || to.endsWith(normalized);
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function addSms(data: Omit<SmsMessage, "id">): SmsMessage {
  const msgs = getAll();
  const msg: SmsMessage = { ...data, id: crypto.randomUUID() };
  msgs.push(msg);
  saveAll(msgs);
  return msg;
}

export function getRecentConversations(limit = 20): { phoneNumber: string; lastMessage: SmsMessage; messageCount: number }[] {
  const msgs = getAll();
  const convos = new Map<string, SmsMessage[]>();

  for (const m of msgs) {
    // Use the non-self number as the conversation key
    const selfNumbers = (process.env.TWILIO_FROM_NUMBER || "").replace(/\D/g, "");
    const from = m.from.replace(/\D/g, "");
    const to = m.to.replace(/\D/g, "");
    const other = from === selfNumbers || from.endsWith(selfNumbers) ? m.to : m.from;
    const key = other.replace(/\D/g, "");

    if (!convos.has(key)) convos.set(key, []);
    convos.get(key)!.push(m);
  }

  return Array.from(convos.entries())
    .map(([phoneNumber, messages]) => ({
      phoneNumber,
      lastMessage: messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
      messageCount: messages.length,
    }))
    .sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime())
    .slice(0, limit);
}
