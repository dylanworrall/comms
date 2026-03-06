import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type AgentMode = "auto" | "draft" | "manual";

export interface Settings {
  agentModes: Record<string, AgentMode>;
  fromEmail: string;
  anthropicModel: string;
  temperature: number;
  voiceProvider?: string;
  voiceApiKey?: string;
  notificationsEnabled: boolean;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "settings.json");

const DEFAULTS: Settings = {
  agentModes: {
    search_contacts: "auto",
    add_contact: "auto",
    update_contact: "auto",
    delete_contact: "manual",
    get_inbox: "auto",
    get_email: "auto",
    send_email: "draft",
    reply_to_email: "draft",
    mark_read: "auto",
    toggle_flag: "auto",
    move_to_folder: "auto",
    get_unread_count: "auto",
    summarize_inbox: "auto",
    get_calls: "auto",
    get_call: "auto",
    add_call: "auto",
    update_call_notes: "auto",
    initiate_call: "draft",
    get_spaces: "auto",
    get_space: "auto",
    create_space: "auto",
    update_space: "auto",
    delete_space: "manual",
    get_threads: "auto",
    get_messages: "auto",
    get_approval_queue: "auto",
    approve_action: "auto",
    get_settings: "auto",
    update_settings: "auto",
    get_activity: "auto",
  },
  fromEmail: "you@example.com",
  anthropicModel: "claude-sonnet-4-20250514",
  temperature: 0.7,
  notificationsEnabled: true,
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Settings {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...saved,
      agentModes: { ...DEFAULTS.agentModes, ...saved.agentModes },
    };
  } catch {
    return { ...DEFAULTS, agentModes: { ...DEFAULTS.agentModes } };
  }
}

function save(settings: Settings): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSettings(): Settings {
  return load();
}

export function updateSettings(updates: Partial<Settings>): Settings {
  const current = load();
  if (updates.agentModes) {
    Object.assign(current.agentModes, updates.agentModes);
  }
  if (updates.fromEmail) current.fromEmail = updates.fromEmail;
  if (updates.anthropicModel) current.anthropicModel = updates.anthropicModel;
  if (updates.temperature !== undefined) current.temperature = updates.temperature;
  if (updates.voiceProvider !== undefined) current.voiceProvider = updates.voiceProvider;
  if (updates.voiceApiKey !== undefined) current.voiceApiKey = updates.voiceApiKey;
  if (updates.notificationsEnabled !== undefined) current.notificationsEnabled = updates.notificationsEnabled;
  save(current);
  return current;
}
