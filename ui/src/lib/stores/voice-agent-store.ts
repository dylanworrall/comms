import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const VOICE_AGENTS_FILE = join(DATA_DIR, "voice-agents.json");

export interface CallCadenceStep {
  day: number;
  action: "call" | "text" | "email";
  templateKey: string;
  onNoAnswer?: "text" | "email" | "voicemail" | "none";
  onNoAnswerTemplate?: string;
}

export type VoiceEngine = "openai" | "gemini";

export interface VoiceAgentConfig {
  id: string;
  agentName: string;
  companyName: string;
  voice: string;
  voiceEngine: VoiceEngine;
  activeTemplate: string;
  customPrompt: string;
  cadence: CallCadenceStep[];
  templates: Record<string, { type: "voicemail" | "text" | "email"; subject?: string; body: string }>;
  callWindows: {
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
    timezone: string;
  };
  maxAttempts: number;
  enableTools: boolean;
  callbackNumber: string;
  transferNumber: string;
  /** Phone number this agent is assigned to */
  phoneNumber: string;
}

// ─── Template Presets ───

const TEMPLATES: Record<string, { label: string; description: string; config: Partial<VoiceAgentConfig> }> = {
  "lead-gen": {
    label: "Lead Generation",
    description: "Outbound sales calls — qualify leads, book demos, handle objections",
    config: {
      agentName: "Jordan",
      activeTemplate: "lead-gen",
      voice: "Achird",
      maxAttempts: 3,
      cadence: [
        { day: 1, action: "call", templateKey: "vm1", onNoAnswer: "text", onNoAnswerTemplate: "text1" },
        { day: 3, action: "call", templateKey: "vm2", onNoAnswer: "email", onNoAnswerTemplate: "email1" },
        { day: 7, action: "call", templateKey: "vm3", onNoAnswer: "email", onNoAnswerTemplate: "email-final" },
      ],
      templates: {
        vm1: { type: "voicemail", body: `Hi [Name], this is [AgentName] from [Company]. I'm reaching out because we help businesses like yours solve [pain point]. I'd love to show you how it works in a quick 10-minute call. Give me a call back at [CallbackNumber]. Again, [AgentName] from [Company]. Have a great day.` },
        vm2: { type: "voicemail", body: `Hi [Name], [AgentName] again from [Company]. Quick follow-up — we just helped a similar business save significant time and money. If you'd like to hear how that could work for you, I'm at [CallbackNumber]. Thanks!` },
        vm3: { type: "voicemail", body: `Hi [Name], last message from me. If the timing isn't right, no worries. But if you're thinking about [pain point], I'm happy to show you what's possible. I'm at [CallbackNumber]. Take care.` },
        text1: { type: "text", body: `Hi [Name], [AgentName] from [Company]. Tried calling — we help businesses like yours with [pain point]. Worth a quick look?` },
        email1: { type: "email", subject: "Quick follow-up", body: `Hi [Name],\n\nQuick follow-up — wanted to see if you'd be open to a 10-minute call about how we're helping businesses like yours.\n\nBest,\n[AgentName]\n[Company]` },
        "email-final": { type: "email", subject: "Should I close your file?", body: `Hi [Name],\n\nI've reached out a few times. Haven't heard back, so I'll assume the timing isn't right.\n\nIf you ever want to learn more, just reply.\n\nEither way — good luck with everything.\n\n[AgentName]\n[Company]` },
      },
      callWindows: { startHour: 9, endHour: 17, daysOfWeek: [1, 2, 3, 4, 5], timezone: "America/Chicago" },
      customPrompt: `You are [AgentName], an outbound sales agent for [Company]. You make calls to potential customers to introduce them to the product/service and book demos.

CALL BEHAVIOR:
- Introduce yourself naturally: "Hi, this is [AgentName] from [Company]."
- Ask if they have a moment to chat.
- If bad time, ask when would be better.
- If interested, qualify them and try to book a demo.
- If not interested, thank them and end politely.
- If voicemail, leave a concise, friendly message.
- Never be pushy. Be warm, conversational, and respectful.
- If they ask to be removed, immediately comply.

QUALIFICATION QUESTIONS:
1. What's your current setup for [pain point]?
2. How many [units/users/locations] do you manage?
3. What's your biggest challenge with [current solution]?

BOOKING:
- If qualified: "I'd love to set up a quick 15-minute demo. What day works best this week?"
- If they want someone specific, offer to transfer.

OBJECTION HANDLING:
- "Too expensive" → "I understand. Most clients found ROI within months. Can I show you the numbers?"
- "Already have a solution" → "That makes sense. What if I showed you how we compare in just 10 minutes?"
- "Send me info" → "Absolutely, I'll send that right over. Can I also book a quick follow-up to walk you through it?"`,
    },
  },
  "customer-support": {
    label: "Customer Support",
    description: "Inbound support calls — troubleshoot, resolve issues, escalate when needed",
    config: {
      agentName: "Alex",
      activeTemplate: "customer-support",
      voice: "Sulafat",
      maxAttempts: 1,
      cadence: [],
      templates: {},
      callWindows: { startHour: 0, endHour: 24, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Chicago" },
      customPrompt: `You are [AgentName], a customer support agent for [Company]. You answer inbound calls from existing customers who need help.

BEHAVIOR:
- Greet warmly: "Thanks for calling [Company], this is [AgentName]. How can I help you today?"
- Listen carefully before responding.
- Ask clarifying questions if needed.
- Provide clear, step-by-step solutions.
- If you can't resolve it, offer to escalate: "Let me connect you with a specialist."
- Always confirm resolution: "Is there anything else I can help with?"
- Be patient, empathetic, and professional.

COMMON SCENARIOS:
- Account questions → Look up info, help directly
- Technical issues → Walk through troubleshooting
- Billing → Explain charges, adjust if appropriate
- Complaints → Acknowledge, apologize, offer resolution
- Feature requests → Thank them, note it

ESCALATION:
- "I want to make sure this gets resolved properly. Let me transfer you to our team."`,
    },
  },
  "receptionist": {
    label: "AI Receptionist",
    description: "Inbound call routing — greet callers, take messages, transfer calls",
    config: {
      agentName: "Sam",
      activeTemplate: "receptionist",
      voice: "Vindemiatrix",
      maxAttempts: 1,
      cadence: [],
      templates: {},
      callWindows: { startHour: 0, endHour: 24, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Chicago" },
      customPrompt: `You are [AgentName], an AI receptionist for [Company]. You answer all incoming calls professionally and route them.

BEHAVIOR:
- Answer: "Thank you for calling [Company], this is [AgentName]. How may I direct your call?"
- Determine the caller's need quickly.
- Transfer if they want someone specific, or take a message.
- Answer general questions if you can.
- Always be polite, professional, efficient.

ROUTING:
- Sales → "Let me connect you with our sales team."
- Support → "I'll transfer you to support."
- General info → Answer directly.
- Specific person → "Let me check if they're available."

TAKING MESSAGES:
- "They're not available right now. Can I take a message?"
- Get: name, phone number, brief message.
- Confirm: "I'll make sure they get your message."`,
    },
  },
  "appointment-setter": {
    label: "Appointment Setter",
    description: "Outbound calls focused on booking appointments and consultations",
    config: {
      agentName: "Morgan",
      activeTemplate: "appointment-setter",
      voice: "Sadachbia",
      maxAttempts: 3,
      cadence: [
        { day: 1, action: "call", templateKey: "vm1", onNoAnswer: "text", onNoAnswerTemplate: "text1" },
        { day: 3, action: "call", templateKey: "vm2", onNoAnswer: "text", onNoAnswerTemplate: "text2" },
        { day: 5, action: "call", templateKey: "vm3", onNoAnswer: "email", onNoAnswerTemplate: "email1" },
      ],
      templates: {
        vm1: { type: "voicemail", body: `Hi [Name], this is [AgentName] from [Company]. I'm calling to see if you'd be open to a quick consultation. We've been helping similar businesses and I think there's a great fit. Call me back at [CallbackNumber]. Thanks!` },
        vm2: { type: "voicemail", body: `Hi [Name], [AgentName] from [Company] again. Just following up — I have a few openings this week for a quick 15-minute chat. Call me at [CallbackNumber] or reply to my text. Thanks!` },
        vm3: { type: "voicemail", body: `Hi [Name], last try from me. If you'd like to explore how we can help, I'm at [CallbackNumber]. If not, no worries at all. Take care!` },
        text1: { type: "text", body: `Hi [Name], [AgentName] from [Company]. Tried calling — would you be open to a quick 15-min chat this week? I have openings!` },
        text2: { type: "text", body: `Hi [Name], following up from [Company]. Still have a couple slots open this week if you'd like to chat. Let me know!` },
        email1: { type: "email", subject: "Quick 15-min chat?", body: `Hi [Name],\n\nI've tried reaching you a couple times. Would you be open to a quick 15-minute call?\n\nI have openings this week and think there could be a great fit.\n\nBest,\n[AgentName]\n[Company]` },
      },
      callWindows: { startHour: 9, endHour: 17, daysOfWeek: [1, 2, 3, 4, 5], timezone: "America/Chicago" },
      customPrompt: `You are [AgentName], an appointment setter for [Company]. Your goal is to book consultations and meetings.

BEHAVIOR:
- Introduce yourself: "Hi, this is [AgentName] from [Company]. Do you have a quick moment?"
- Get to the point fast — respect their time.
- Focus on booking, not selling. Your job is to get them to a meeting.
- Be friendly and low-pressure.

BOOKING FLOW:
1. Quick intro and reason for calling.
2. Ask one qualifying question to confirm fit.
3. Propose specific times: "Would Tuesday at 2pm or Thursday at 10am work better?"
4. Confirm details: name, email, preferred time.
5. "Great, you're all set. You'll get a calendar invite shortly."

IF THEY PUSH BACK:
- "I totally understand. When would be a better time to connect?"
- "No pressure at all. Can I send you some info and follow up next week?"
- "That's fine. If anything changes, you can always reach us at [CallbackNumber]."`,
    },
  },
  "survey": {
    label: "Survey / Feedback",
    description: "Outbound calls to collect feedback, run surveys, or gather NPS scores",
    config: {
      agentName: "Casey",
      activeTemplate: "survey",
      voice: "Algieba",
      maxAttempts: 2,
      cadence: [
        { day: 1, action: "call", templateKey: "vm1", onNoAnswer: "text", onNoAnswerTemplate: "text1" },
        { day: 4, action: "call", templateKey: "vm2", onNoAnswer: "none" },
      ],
      templates: {
        vm1: { type: "voicemail", body: `Hi [Name], this is [AgentName] from [Company]. We're reaching out to get your quick feedback — it takes about 2 minutes. Please call us back at [CallbackNumber]. Thanks!` },
        vm2: { type: "voicemail", body: `Hi [Name], [AgentName] from [Company] again. Last try for your feedback — we really value your input. Call us at [CallbackNumber] if you get a chance. Thanks!` },
        text1: { type: "text", body: `Hi [Name], [AgentName] from [Company]. We'd love your quick feedback (2 mins). Can we call you back at a better time?` },
      },
      callWindows: { startHour: 10, endHour: 18, daysOfWeek: [1, 2, 3, 4, 5], timezone: "America/Chicago" },
      customPrompt: `You are [AgentName], calling on behalf of [Company] to collect customer feedback.

BEHAVIOR:
- Greet warmly: "Hi [Name], this is [AgentName] from [Company]. We're reaching out to get your quick feedback — it'll only take about 2 minutes. Is now a good time?"
- If yes, proceed with questions.
- If no, ask for a better time.
- Be genuinely grateful for their time.
- Keep it conversational, not robotic.

SURVEY FLOW:
1. "On a scale of 1-10, how likely are you to recommend [Company] to a friend or colleague?"
2. "What's the main reason for that score?"
3. "Is there one thing we could do better?"
4. "Any other feedback you'd like to share?"

CLOSING:
- "Thank you so much for your time, [Name]. Your feedback really helps us improve. Have a great day!"`,
    },
  },
};

// ─── Storage ───

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

interface VoiceAgentsData {
  agents: VoiceAgentConfig[];
  /** Which agent ID is used as default (for calls without a specific number) */
  defaultAgentId: string;
}

function loadAll(): VoiceAgentsData {
  ensureDir();
  try {
    const raw = readFileSync(VOICE_AGENTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { agents: [], defaultAgentId: "" };
  }
}

function saveAll(data: VoiceAgentsData) {
  ensureDir();
  writeFileSync(VOICE_AGENTS_FILE, JSON.stringify(data, null, 2));
}

function makeDefaultAgent(): VoiceAgentConfig {
  const t = TEMPLATES["lead-gen"].config;
  return {
    id: randomUUID(),
    agentName: t.agentName || "Jordan",
    companyName: "My Company",
    voice: t.voice || "Achird",
    voiceEngine: "gemini",
    activeTemplate: "lead-gen",
    customPrompt: t.customPrompt || "",
    cadence: t.cadence || [],
    templates: t.templates || {},
    callWindows: t.callWindows || { startHour: 9, endHour: 17, daysOfWeek: [1, 2, 3, 4, 5], timezone: "America/Chicago" },
    maxAttempts: 3,
    enableTools: true,
    callbackNumber: "",
    transferNumber: "",
    phoneNumber: "",
  };
}

// ─── Public API ───

export function getAllAgents(): VoiceAgentConfig[] {
  const data = loadAll();
  if (data.agents.length === 0) {
    // Auto-create a default agent
    const agent = makeDefaultAgent();
    data.agents.push(agent);
    data.defaultAgentId = agent.id;
    saveAll(data);
  }
  return data.agents;
}

export function getAgentById(id: string): VoiceAgentConfig | undefined {
  return loadAll().agents.find((a) => a.id === id);
}

export function getAgentByPhoneNumber(phoneNumber: string): VoiceAgentConfig | undefined {
  const data = loadAll();
  return data.agents.find((a) => a.phoneNumber === phoneNumber);
}

export function getDefaultAgent(): VoiceAgentConfig {
  const data = loadAll();
  const agents = getAllAgents(); // ensures at least one exists
  const defaultAgent = agents.find((a) => a.id === data.defaultAgentId);
  return defaultAgent || agents[0];
}

/** Backwards compat — returns the default agent */
export function getVoiceAgentConfig(): VoiceAgentConfig {
  return getDefaultAgent();
}

export function createAgent(templateKey?: string): VoiceAgentConfig {
  const data = loadAll();
  const agent = makeDefaultAgent();

  if (templateKey && TEMPLATES[templateKey]) {
    const t = TEMPLATES[templateKey].config;
    Object.assign(agent, t, { id: agent.id, activeTemplate: templateKey });
  }

  data.agents.push(agent);
  if (!data.defaultAgentId) data.defaultAgentId = agent.id;
  saveAll(data);
  return agent;
}

export function updateAgent(id: string, updates: Partial<VoiceAgentConfig>): VoiceAgentConfig | null {
  const data = loadAll();
  const idx = data.agents.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  data.agents[idx] = { ...data.agents[idx], ...updates, id };
  saveAll(data);
  return data.agents[idx];
}

export function deleteAgent(id: string): boolean {
  const data = loadAll();
  const idx = data.agents.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  data.agents.splice(idx, 1);
  if (data.defaultAgentId === id) {
    data.defaultAgentId = data.agents[0]?.id || "";
  }
  saveAll(data);
  return true;
}

export function setDefaultAgent(id: string) {
  const data = loadAll();
  data.defaultAgentId = id;
  saveAll(data);
}

export function applyTemplateToAgent(agentId: string, templateKey: string): VoiceAgentConfig | null {
  const template = TEMPLATES[templateKey];
  if (!template) return null;
  return updateAgent(agentId, { ...template.config, activeTemplate: templateKey });
}

export function getTemplatePresets() {
  return Object.entries(TEMPLATES).map(([key, val]) => ({
    key,
    label: val.label,
    description: val.description,
  }));
}

export function buildVoicePrompt(config: VoiceAgentConfig, context?: { contactName?: string; purpose?: string }): string {
  let prompt = config.customPrompt || TEMPLATES[config.activeTemplate]?.config.customPrompt || "";

  prompt = prompt.replace(/\[AgentName\]/g, config.agentName);
  prompt = prompt.replace(/\[Company\]/g, config.companyName);
  prompt = prompt.replace(/\[CallbackNumber\]/g, config.callbackNumber || "our main line");
  prompt = prompt.replace(/\[Name\]/g, context?.contactName || "there");

  if (context?.purpose) {
    prompt += `\n\nSPECIFIC PURPOSE FOR THIS CALL: ${context.purpose}`;
  }

  return prompt;
}

export const GEMINI_VOICES = [
  { id: "Achird", label: "Achird", description: "Friendly" },
  { id: "Sulafat", label: "Sulafat", description: "Warm" },
  { id: "Vindemiatrix", label: "Vindemiatrix", description: "Gentle" },
  { id: "Algieba", label: "Algieba", description: "Smooth" },
  { id: "Achernar", label: "Achernar", description: "Soft" },
  { id: "Gacrux", label: "Gacrux", description: "Mature" },
  { id: "Sadachbia", label: "Sadachbia", description: "Lively" },
  { id: "Kore", label: "Kore", description: "Firm" },
  { id: "Puck", label: "Puck", description: "Upbeat" },
  { id: "Charon", label: "Charon", description: "Informative" },
  { id: "Fenrir", label: "Fenrir", description: "Excitable" },
  { id: "Leda", label: "Leda", description: "Youthful" },
  { id: "Orus", label: "Orus", description: "Firm" },
  { id: "Aoede", label: "Aoede", description: "Breezy" },
  { id: "Zephyr", label: "Zephyr", description: "Bright" },
  { id: "Schedar", label: "Schedar", description: "Even" },
  { id: "Rasalgethi", label: "Rasalgethi", description: "Informative" },
  { id: "Pulcherrima", label: "Pulcherrima", description: "Forward" },
  { id: "Zubenelgenubi", label: "Zubenelgenubi", description: "Casual" },
  { id: "Alnilam", label: "Alnilam", description: "Firm" },
];

export const OPENAI_VOICES = [
  { id: "alloy", label: "Alloy", description: "Neutral" },
  { id: "ash", label: "Ash", description: "Confident" },
  { id: "ballad", label: "Ballad", description: "Warm" },
  { id: "coral", label: "Coral", description: "Friendly" },
  { id: "echo", label: "Echo", description: "Smooth" },
  { id: "sage", label: "Sage", description: "Calm" },
  { id: "shimmer", label: "Shimmer", description: "Bright" },
  { id: "verse", label: "Verse", description: "Versatile" },
];

/** Backwards-compat alias — returns Gemini voices */
export const AVAILABLE_VOICES = GEMINI_VOICES;

export function getVoicesForEngine(engine: VoiceEngine) {
  return engine === "openai" ? OPENAI_VOICES : GEMINI_VOICES;
}
