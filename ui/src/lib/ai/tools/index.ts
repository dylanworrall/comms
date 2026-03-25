import { tool } from "ai";

// ─── Contacts ───
import { listContactsTool, getContactTool, createContactTool, updateContactTool, searchContactsTool } from "./contacts";

// ─── Email (local inbox) ───
import { listEmailsTool, readEmailTool, draftEmailTool, sendEmailTool, replyToEmailTool } from "./email";

// ─── Calls ───
import { listCallsTool, getCallTranscriptTool, initiateCallTool } from "./calls";

// ─── Calendar ───
import { listEventsTool, createEventTool, checkAvailabilityTool } from "./calendar";

// ─── Approvals ───
import { listPendingApprovalsTool, approveActionTool, denyActionTool } from "./approvals";

// ─── Spaces ───
import { listSpacesTool, getSpaceTool, createSpaceTool } from "./spaces";

// ─── Settings ───
import { getSettingsTool } from "./settings";

// ─── Gmail ───
import {
  searchGmailTool, readGmailThreadTool, syncGmailTool, sendGmailTool,
  draftGmailTool, trashGmailTool, archiveGmailTool, markGmailReadTool, replyGmailTool,
} from "./gmail";

// ─── AI Email ───
import { processEmailsTool, getPriorityEmailsTool, summarizeInboxTool } from "./ai-email";

/**
 * Connector-spec export: flat array of all tools.
 * Each tool has { name, description, inputSchema, execute }.
 */
export const tools = [
  // Contacts
  listContactsTool,
  getContactTool,
  createContactTool,
  updateContactTool,
  searchContactsTool,
  // Email (local)
  listEmailsTool,
  readEmailTool,
  draftEmailTool,
  sendEmailTool,
  replyToEmailTool,
  // Calls
  listCallsTool,
  getCallTranscriptTool,
  initiateCallTool,
  // Calendar
  listEventsTool,
  createEventTool,
  checkAvailabilityTool,
  // Approvals
  listPendingApprovalsTool,
  approveActionTool,
  denyActionTool,
  // Spaces
  listSpacesTool,
  getSpaceTool,
  createSpaceTool,
  // Settings
  getSettingsTool,
  // Gmail
  searchGmailTool,
  readGmailThreadTool,
  syncGmailTool,
  sendGmailTool,
  draftGmailTool,
  trashGmailTool,
  archiveGmailTool,
  markGmailReadTool,
  replyGmailTool,
  // AI Email
  processEmailsTool,
  getPriorityEmailsTool,
  summarizeInboxTool,
];

/**
 * Backward-compat export for Vercel AI SDK streamText().
 * Keyed by tool name, wrapped with tool() for type compatibility.
 */
export const allTools = Object.fromEntries(
  tools.map((t) => [
    t.name,
    tool({ description: t.description, inputSchema: t.inputSchema, execute: t.execute } as any),
  ])
);
