import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "sms-agent.json");

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
}

export interface SmsAgentConfig {
  agentName: string;
  companyName: string;
  autoReply: boolean; // Auto-reply to inbound SMS
  autoReplyDelay: number; // Seconds to wait before auto-replying (0 = instant)
  systemPrompt: string;
  templates: SmsTemplate[];
  optOutMessage: string;
  workingHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
    timezone: string;
    outsideHoursMessage: string; // Auto-reply when outside working hours
  };
  signature: string; // Appended to all outbound messages
}

const TEMPLATE_PRESETS: Record<string, { label: string; description: string; config: Partial<SmsAgentConfig> }> = {
  "outreach": {
    label: "Creator Outreach",
    description: "Cold outreach to creators — friendly, concise, gets to the point",
    config: {
      agentName: "Jordan",
      autoReply: true,
      autoReplyDelay: 30,
      systemPrompt: `You are [AgentName] from [Company]. You handle SMS conversations with creators and potential partners.

RULES:
- Keep messages SHORT — 2-3 sentences max. This is texting, not email.
- Be casual but professional. No corporate speak.
- Respond to questions directly.
- If they ask to stop or say "not interested", respect it immediately.
- If they show interest, try to book a call or get their email.
- Use their name when you know it.
- Never send walls of text.

GOAL: Build rapport, answer questions, move toward a call or meeting.`,
      templates: [
        { id: "intro", name: "Initial Outreach", body: "Hey [Name]! Came across your content and love what you're doing. We're working on something I think you'd be interested in — mind if I share a quick overview?" },
        { id: "followup", name: "Follow-up", body: "Hey [Name], just circling back on my last message. Would love to connect if you have a sec!" },
        { id: "booking", name: "Book a Call", body: "Awesome! Want to hop on a quick 10-min call this week? I'm free [Day] afternoon or [Day] morning." },
      ],
    },
  },
  "support": {
    label: "Customer Support",
    description: "Handle inbound support questions via text",
    config: {
      agentName: "Alex",
      autoReply: true,
      autoReplyDelay: 0,
      systemPrompt: `You are [AgentName] from [Company]. You handle customer support via SMS.

RULES:
- Reply quickly and helpfully.
- Keep messages concise — this is text, not email.
- If you can solve it, do it. If not, escalate.
- Be empathetic and patient.
- Confirm resolution: "All set! Anything else?"

COMMON ISSUES: Account questions, billing, technical help, feature requests.`,
      templates: [
        { id: "greeting", name: "Greeting", body: "Hey! This is [AgentName] from [Company]. How can I help?" },
        { id: "resolved", name: "Issue Resolved", body: "All taken care of! Let me know if anything else comes up." },
      ],
    },
  },
  "notifications": {
    label: "Notifications Only",
    description: "Send alerts and updates — no auto-reply",
    config: {
      agentName: "Comms",
      autoReply: false,
      autoReplyDelay: 0,
      systemPrompt: "",
      templates: [
        { id: "reminder", name: "Appointment Reminder", body: "Reminder: Your appointment is tomorrow at [Time]. Reply to confirm or reschedule." },
        { id: "update", name: "Status Update", body: "Update: [Status]. Let us know if you have any questions." },
      ],
    },
  },
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULTS: SmsAgentConfig = {
  agentName: "Jordan",
  companyName: "Soshi",
  autoReply: false,
  autoReplyDelay: 30,
  systemPrompt: TEMPLATE_PRESETS["outreach"].config.systemPrompt || "",
  templates: TEMPLATE_PRESETS["outreach"].config.templates || [],
  optOutMessage: "You've been unsubscribed. No more messages will be sent.",
  workingHours: {
    enabled: false,
    startHour: 9,
    endHour: 17,
    daysOfWeek: [1, 2, 3, 4, 5],
    timezone: "America/Chicago",
    outsideHoursMessage: "Thanks for your message! We'll get back to you during business hours.",
  },
  signature: "",
};

function load(): SmsAgentConfig {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(config: SmsAgentConfig): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getSmsAgentConfig(): SmsAgentConfig {
  return load();
}

export function updateSmsAgentConfig(updates: Partial<SmsAgentConfig>): SmsAgentConfig {
  const current = load();
  const updated = { ...current, ...updates };
  save(updated);
  return updated;
}

export function getSmsTemplatePresets() {
  return Object.entries(TEMPLATE_PRESETS).map(([key, val]) => ({
    id: key,
    label: val.label,
    description: val.description,
  }));
}

export function applySmsPreset(presetId: string): SmsAgentConfig {
  const preset = TEMPLATE_PRESETS[presetId];
  if (!preset) return load();
  const current = load();
  const updated = { ...current, ...preset.config };
  save(updated);
  return updated;
}

export function buildSmsPrompt(config: SmsAgentConfig, context?: { contactName?: string }): string {
  let prompt = config.systemPrompt;
  prompt = prompt.replace(/\[AgentName\]/g, config.agentName);
  prompt = prompt.replace(/\[Company\]/g, config.companyName);
  if (context?.contactName) {
    prompt = prompt.replace(/\[Name\]/g, context.contactName);
  }
  return prompt;
}
