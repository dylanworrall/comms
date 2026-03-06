import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Space {
  id: string;
  name: string;
  description: string;
  tone: string;
  defaultRecipients: string[];
  emailSignature: string;
  templates: { name: string; subject: string; body: string }[];
  autoApprove: string[];
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const FILE_PATH = join(DATA_DIR, "spaces.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getAll(): Space[] {
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as Space[];
  } catch {
    return [];
  }
}

function saveAll(items: Space[]): void {
  ensureDir();
  writeFileSync(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

const SEED_SPACES: Omit<Space, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Sales Outreach",
    description: "Cold outreach, follow-ups, and deal communications",
    tone: "Professional, confident, and concise. Focus on value propositions and clear CTAs.",
    defaultRecipients: [],
    emailSignature: "Best regards,\n\n— Sent via Comms",
    templates: [
      {
        name: "Cold Outreach",
        subject: "Quick question about {{company}}",
        body: "Hi {{name}},\n\nI came across {{company}} and was impressed by {{reason}}. I think there's a great opportunity for us to collaborate.\n\nWould you be open to a 15-minute call this week?\n\nBest regards",
      },
      {
        name: "Follow-Up",
        subject: "Following up — {{topic}}",
        body: "Hi {{name}},\n\nJust wanted to circle back on my previous message about {{topic}}. I understand you're busy, so I'll keep this brief.\n\nWould any of these times work for a quick chat?\n\n- {{time1}}\n- {{time2}}\n\nLooking forward to hearing from you.",
      },
    ],
    autoApprove: ["search_contacts", "get_inbox"],
  },
  {
    name: "Support",
    description: "Customer support responses, issue resolution, and help desk",
    tone: "Empathetic, helpful, and solution-oriented. Acknowledge the issue before offering fixes.",
    defaultRecipients: [],
    emailSignature: "Happy to help!\n\n— Support Team",
    templates: [
      {
        name: "Issue Acknowledgment",
        subject: "Re: {{issue}} — We're on it",
        body: "Hi {{name}},\n\nThank you for reaching out about {{issue}}. I understand how frustrating this must be, and I want to assure you we're looking into it right away.\n\nHere's what we know so far:\n- {{details}}\n\nI'll follow up within 24 hours with an update. In the meantime, please don't hesitate to reply if you have any additional information.\n\nBest,\nSupport Team",
      },
      {
        name: "Resolution",
        subject: "Re: {{issue}} — Resolved",
        body: "Hi {{name}},\n\nGreat news! The issue with {{issue}} has been resolved. Here's what we did:\n\n{{resolution}}\n\nPlease let us know if you experience any further issues. We're always here to help.\n\nBest,\nSupport Team",
      },
    ],
    autoApprove: ["search_contacts", "get_inbox", "get_calls"],
  },
  {
    name: "Personal",
    description: "Personal emails, networking, and casual correspondence",
    tone: "Warm, friendly, and authentic. Keep it natural and conversational.",
    defaultRecipients: [],
    emailSignature: "Cheers!",
    templates: [
      {
        name: "Catch Up",
        subject: "Long time no talk!",
        body: "Hey {{name}},\n\nIt's been a while! Hope you're doing well. I was thinking about {{topic}} the other day and it reminded me of you.\n\nWould love to grab coffee sometime and catch up. Are you free this week?\n\nTalk soon!",
      },
    ],
    autoApprove: ["search_contacts"],
  },
  {
    name: "Team",
    description: "Internal team communications, updates, and coordination",
    tone: "Direct, collaborative, and action-oriented. Use bullet points and clear ownership.",
    defaultRecipients: ["team@example.com"],
    emailSignature: "Thanks,\n— Team Comms",
    templates: [
      {
        name: "Status Update",
        subject: "{{project}} — Weekly Update",
        body: "Hi team,\n\nHere's the weekly update for {{project}}:\n\n**Completed:**\n- {{done1}}\n- {{done2}}\n\n**In Progress:**\n- {{wip1}}\n\n**Blockers:**\n- {{blocker}}\n\nLet me know if you have questions or need anything unblocked.",
      },
      {
        name: "Meeting Notes",
        subject: "Notes: {{meeting}} — {{date}}",
        body: "Hi all,\n\nHere are the notes from today's {{meeting}}:\n\n**Attendees:** {{attendees}}\n\n**Key Decisions:**\n- {{decision1}}\n\n**Action Items:**\n- [ ] {{action1}} (Owner: {{owner1}})\n- [ ] {{action2}} (Owner: {{owner2}})\n\n**Next Meeting:** {{nextDate}}",
      },
    ],
    autoApprove: ["search_contacts", "get_inbox", "get_calls"],
  },
];

function seedIfEmpty(): Space[] {
  let spaces = getAll();
  if (spaces.length === 0) {
    const now = new Date().toISOString();
    spaces = SEED_SPACES.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    saveAll(spaces);
  }
  return spaces;
}

export function getAllSpaces(): Space[] {
  return seedIfEmpty();
}

export function getSpaceById(id: string): Space | null {
  return seedIfEmpty().find((s) => s.id === id) ?? null;
}

export function createSpace(
  data: Omit<Space, "id" | "createdAt" | "updatedAt">
): Space {
  const spaces = seedIfEmpty();
  const now = new Date().toISOString();
  const space: Space = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  spaces.push(space);
  saveAll(spaces);
  return space;
}

export function updateSpace(
  id: string,
  data: Partial<Omit<Space, "id" | "createdAt">>
): Space | null {
  const spaces = seedIfEmpty();
  const space = spaces.find((s) => s.id === id);
  if (!space) return null;
  Object.assign(space, data, { updatedAt: new Date().toISOString() });
  saveAll(spaces);
  return space;
}

export function deleteSpace(id: string): boolean {
  const spaces = seedIfEmpty();
  const idx = spaces.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  spaces.splice(idx, 1);
  saveAll(spaces);
  return true;
}
