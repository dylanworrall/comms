import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  notes?: string;
  lastContacted?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "contacts.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): Contact[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

function saveAll(items: Contact[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

const SEED_CONTACTS: Omit<Contact, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@acmecorp.com",
    phone: "+1-415-555-0142",
    company: "Acme Corp",
    tags: ["client", "enterprise"],
    notes: "VP of Product. Key decision maker for Q2 partnership.",
    lastContacted: "2026-03-04T14:30:00.000Z",
    avatar: "SC",
  },
  {
    name: "James Wright",
    email: "james.wright@venturelabs.io",
    phone: "+1-212-555-0198",
    company: "Venture Labs",
    tags: ["vendor", "ai"],
    notes: "Founder. Proposed AI integration services — $45K/3mo.",
    lastContacted: "2026-03-04T16:42:00.000Z",
    avatar: "JW",
  },
  {
    name: "Maya Patel",
    email: "maya.patel@designhub.co",
    phone: "+1-628-555-0167",
    company: "DesignHub",
    tags: ["team", "design"],
    notes: "New design lead starting Monday. Previously at Figma.",
    avatar: "MP",
  },
  {
    name: "Carlos Rivera",
    email: "carlos.rivera@startupfund.vc",
    phone: "+1-305-555-0134",
    company: "Startup Fund VC",
    tags: ["investor", "networking"],
    notes: "Met at TechCrunch Disrupt. Interested in Series A conversations.",
    lastContacted: "2026-02-20T10:00:00.000Z",
    avatar: "CR",
  },
  {
    name: "Emily Nakamura",
    email: "emily.nakamura@cloudsyncinc.com",
    company: "CloudSync Inc",
    tags: ["prospect", "saas"],
    notes: "Requested a demo after conference. Follow up needed.",
    avatar: "EN",
  },
];

function seedIfEmpty(): Contact[] {
  let contacts = getAll();
  if (contacts.length === 0) {
    const now = new Date().toISOString();
    contacts = SEED_CONTACTS.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    saveAll(contacts);
  }
  return contacts;
}

export function searchContacts(query: string): Contact[] {
  const contacts = seedIfEmpty();
  const q = query.toLowerCase();
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function addContact(data: Omit<Contact, "id" | "createdAt" | "updatedAt">): Contact {
  const contacts = seedIfEmpty();
  const contact: Contact = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  contacts.push(contact);
  saveAll(contacts);
  return contact;
}

export function getAllContacts(limit?: number): Contact[] {
  const contacts = seedIfEmpty();
  if (limit) return contacts.slice(0, limit);
  return contacts;
}

export function getContactById(id: string): Contact | null {
  return seedIfEmpty().find((c) => c.id === id) ?? null;
}

export function updateContact(
  id: string,
  data: Partial<Omit<Contact, "id" | "createdAt">>
): Contact | null {
  const contacts = seedIfEmpty();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const contact = contacts[idx];
  Object.assign(contact, data, { updatedAt: new Date().toISOString() });
  saveAll(contacts);
  return contact;
}

export function deleteContact(id: string): boolean {
  const contacts = seedIfEmpty();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  contacts.splice(idx, 1);
  saveAll(contacts);
  return true;
}
