import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AITag {
  id: string;
  name: string;
  points: number;
  color: string;
}

export interface AIProject {
  id: string;
  name: string;
  emoji: string;
  domain: string; // email domain to match, e.g. "myapp.com" — matches To/From
}

export interface AIEmailSettings {
  enabled: boolean;
  tags: AITag[];
  projects: AIProject[];
  autoRespond: boolean;
  systemPrompt: string;
  processedIds: string[];
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "ai-settings.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULTS: AIEmailSettings = {
  enabled: false,
  tags: [
    { id: "tag-urgent", name: "Urgent", points: 10, color: "red" },
    { id: "tag-customer", name: "Potential Customer", points: 7, color: "green" },
    { id: "tag-followup", name: "Follow-up Needed", points: 5, color: "amber" },
    { id: "tag-bug", name: "Bug Report", points: 8, color: "orange" },
    { id: "tag-newsletter", name: "Newsletter", points: -3, color: "gray" },
  ],
  projects: [],
  autoRespond: false,
  systemPrompt:
    "You are an email triage assistant. Classify emails by importance, identify the sender type (human vs automated), and suggest responses when appropriate. Be concise and professional.",
  processedIds: [],
};

function load(): AIEmailSettings {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: AIEmailSettings): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export function getAISettings(): AIEmailSettings {
  return load();
}

export function updateAISettings(updates: Partial<Omit<AIEmailSettings, "processedIds">>): AIEmailSettings {
  const current = load();
  const updated = { ...current, ...updates };
  save(updated);
  return updated;
}

export function addProcessedId(emailId: string): void {
  const settings = load();
  if (!settings.processedIds.includes(emailId)) {
    settings.processedIds.push(emailId);
    // Cap at 5000 to prevent unbounded growth
    if (settings.processedIds.length > 5000) {
      settings.processedIds = settings.processedIds.slice(-3000);
    }
    save(settings);
  }
}

export function isProcessed(emailId: string): boolean {
  return load().processedIds.includes(emailId);
}

export function clearProcessedIds(): void {
  const settings = load();
  settings.processedIds = [];
  save(settings);
}
