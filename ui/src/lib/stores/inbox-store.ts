import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  preview: string;
  timestamp: string;
  read: boolean;
  flagged: boolean;
  folder: "inbox" | "sent" | "drafts" | "trash";
  threadId?: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "inbox.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): Email[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as Email[];
  } catch {
    return [];
  }
}

function saveAll(items: Email[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

const SEED_EMAILS: Omit<Email, "id">[] = [
  {
    from: "sarah.chen@acmecorp.com",
    fromName: "Sarah Chen",
    to: "you@example.com",
    subject: "Q2 Strategy Meeting — Thursday 2pm",
    body: "Hi there,\n\nI wanted to confirm our Q2 strategy meeting for this Thursday at 2pm. We'll be covering the product roadmap, marketing budget allocation, and the new partnership pipeline.\n\nPlease review the attached deck beforehand if you get a chance.\n\nBest,\nSarah",
    preview: "Hi there, I wanted to confirm our Q2 strategy meeting for this Thursday at 2pm. We'll be covering the product roadmap, marketing bud",
    timestamp: "2026-03-05T09:15:00.000Z",
    read: false,
    flagged: false,
    folder: "inbox",
    threadId: "thread-q2-strategy",
  },
  {
    from: "james.wright@venturelabs.io",
    fromName: "James Wright",
    to: "you@example.com",
    subject: "Proposal: AI Integration Services",
    body: "Hello,\n\nFollowing our conversation last week, I've put together a proposal for the AI integration services we discussed. The scope includes:\n\n1. Custom model fine-tuning\n2. API integration layer\n3. Monitoring dashboard\n\nTotal estimate: $45,000 over 3 months. Let me know if you'd like to schedule a call to discuss.\n\nRegards,\nJames Wright\nVenture Labs",
    preview: "Hello, Following our conversation last week, I've put together a proposal for the AI integration services we discussed. The scope",
    timestamp: "2026-03-04T16:42:00.000Z",
    read: false,
    flagged: true,
    folder: "inbox",
  },
  {
    from: "maya.patel@designhub.co",
    fromName: "Maya Patel",
    to: "you@example.com",
    cc: "team@example.com",
    subject: "Introduction — New Design Lead",
    body: "Hi everyone,\n\nI'm Maya, the new design lead joining the team next Monday. I'm excited to get started and wanted to introduce myself before my first day.\n\nI've been in product design for 8 years, most recently at Figma. Looking forward to collaborating with all of you!\n\nWarm regards,\nMaya Patel",
    preview: "Hi everyone, I'm Maya, the new design lead joining the team next Monday. I'm excited to get started and wanted to introduce myself",
    timestamp: "2026-03-04T11:20:00.000Z",
    read: true,
    flagged: false,
    folder: "inbox",
  },
  {
    from: "noreply@github.com",
    fromName: "GitHub",
    to: "you@example.com",
    subject: "[comms-ui] Pull request #42: Add inbox store",
    body: "A new pull request has been opened on comms-ui by @developer:\n\n#42 Add inbox store\n\nThis PR adds the inbox JSON store with seed data and filtering capabilities.\n\n— Reply to this email directly or view it on GitHub.",
    preview: "A new pull request has been opened on comms-ui by @developer: #42 Add inbox store This PR adds the inbox JSON store with seed dat",
    timestamp: "2026-03-03T22:05:00.000Z",
    read: true,
    flagged: false,
    folder: "inbox",
  },
  {
    from: "you@example.com",
    fromName: "You",
    to: "sarah.chen@acmecorp.com",
    subject: "Re: Q2 Strategy Meeting — Thursday 2pm",
    body: "Hi Sarah,\n\nThursday at 2pm works perfectly. I'll review the deck tonight.\n\nSee you then!",
    preview: "Hi Sarah, Thursday at 2pm works perfectly. I'll review the deck tonight. See you then!",
    timestamp: "2026-03-05T10:03:00.000Z",
    read: true,
    flagged: false,
    folder: "sent",
    threadId: "thread-q2-strategy",
  },
];

function seedIfEmpty(): Email[] {
  let emails = getAll();
  if (emails.length === 0) {
    emails = SEED_EMAILS.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
    }));
    saveAll(emails);
  }
  return emails;
}

export function getAllEmails(): Email[] {
  return seedIfEmpty();
}

export function getEmailById(id: string): Email | null {
  return seedIfEmpty().find((e) => e.id === id) ?? null;
}

export function getEmails(opts: {
  folder?: Email["folder"];
  unreadOnly?: boolean;
  flagged?: boolean;
  limit?: number;
}): Email[] {
  let emails = seedIfEmpty();

  if (opts.folder) {
    emails = emails.filter((e) => e.folder === opts.folder);
  }
  if (opts.unreadOnly) {
    emails = emails.filter((e) => !e.read);
  }
  if (opts.flagged) {
    emails = emails.filter((e) => e.flagged);
  }

  // Sort newest first
  emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (opts.limit) {
    emails = emails.slice(0, opts.limit);
  }

  return emails;
}

export function addEmail(
  data: Omit<Email, "id" | "preview">
): Email {
  const emails = seedIfEmpty();
  const email: Email = {
    ...data,
    id: crypto.randomUUID(),
    preview: data.body.replace(/\n/g, " ").slice(0, 120),
  };
  emails.push(email);
  saveAll(emails);
  return email;
}

export function markRead(id: string): Email | null {
  const emails = seedIfEmpty();
  const email = emails.find((e) => e.id === id);
  if (!email) return null;
  email.read = true;
  saveAll(emails);
  return email;
}

export function toggleFlag(id: string): Email | null {
  const emails = seedIfEmpty();
  const email = emails.find((e) => e.id === id);
  if (!email) return null;
  email.flagged = !email.flagged;
  saveAll(emails);
  return email;
}

export function moveToFolder(id: string, folder: Email["folder"]): Email | null {
  const emails = seedIfEmpty();
  const email = emails.find((e) => e.id === id);
  if (!email) return null;
  email.folder = folder;
  saveAll(emails);
  return email;
}

export function getUnreadCount(): number {
  return seedIfEmpty().filter((e) => !e.read && e.folder === "inbox").length;
}
