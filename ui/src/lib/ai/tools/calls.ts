import { z } from "zod";
import { getCalls, getCallById } from "@/lib/stores/calls-store";
import { createApproval } from "@/lib/stores/approvals";

export const listCallsTool = {
  name: "list_calls",
  description:
    "List call records with optional filters for limit, direction, and contact name.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of call records to return"),
    direction: z
      .enum(["inbound", "outbound"])
      .optional()
      .describe("Filter by call direction"),
    contactName: z
      .string()
      .optional()
      .describe("Filter by contact name (partial match)"),
  }),
  execute: async ({ limit, direction, contactName }: { limit?: number; direction?: "inbound" | "outbound"; contactName?: string }) => {
    const calls = getCalls({ limit, direction, contactName });
    if (calls.length === 0) {
      return { message: "No call records found.", calls: [] };
    }
    return {
      message: `${calls.length} call record(s) found`,
      calls: calls.map((c) => ({
        id: c.id,
        contactName: c.contactName,
        phoneNumber: c.phoneNumber,
        direction: c.direction,
        status: c.status,
        duration: c.duration,
        timestamp: c.timestamp,
        hasTranscript: !!c.transcript,
        notes: c.notes,
      })),
    };
  },
};

export const getCallTranscriptTool = {
  name: "get_call_transcript",
  description:
    "Get the full transcript and details of a specific call by its ID.",
  inputSchema: z.object({
    id: z.string().describe("The call record ID"),
  }),
  execute: async ({ id }: { id: string }) => {
    const call = getCallById(id);
    if (!call) {
      return { message: `No call record found with ID "${id}"` };
    }
    if (!call.transcript) {
      return {
        message: `Call with ${call.contactName} has no transcript available`,
        call: {
          id: call.id,
          contactName: call.contactName,
          phoneNumber: call.phoneNumber,
          direction: call.direction,
          status: call.status,
          duration: call.duration,
          timestamp: call.timestamp,
          notes: call.notes,
        },
      };
    }
    return {
      message: `Transcript for call with ${call.contactName}`,
      call: {
        id: call.id,
        contactName: call.contactName,
        phoneNumber: call.phoneNumber,
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        timestamp: call.timestamp,
        transcript: call.transcript,
        notes: call.notes,
      },
    };
  },
};

export const initiateCallTool = {
  name: "initiate_call",
  description:
    "Place a phone call to a given number. The AI voice agent will handle the conversation in real-time. Optionally include a purpose/message for the AI to deliver. This creates an approval item — the call is NOT placed until the user approves it.",
  inputSchema: z.object({
    phoneNumber: z.string().describe("The phone number to call"),
    contactName: z
      .string()
      .optional()
      .describe("Name of the person being called (for display)"),
    purpose: z
      .string()
      .optional()
      .describe("Brief description of the call's purpose or message to deliver (e.g., 'tell them I'm running late', 'schedule a meeting')"),
  }),
  execute: async ({ phoneNumber, contactName, purpose }: { phoneNumber: string; contactName?: string; purpose?: string }) => {
    const displayName = contactName ?? phoneNumber;
    const approval = createApproval("initiate_call", {
      phoneNumber,
      contactName: displayName,
      aiVoiceCall: true,
      purpose: purpose || "General AI voice call",
    });
    return {
      message: `AI voice call to ${displayName} (${phoneNumber}) queued for approval (ID: ${approval.id}). When approved, the AI agent will call and speak to them${purpose ? ` about: ${purpose}` : ""}.`,
      needsApproval: true,
      approvalId: approval.id,
      call: { phoneNumber, contactName: displayName, purpose },
    };
  },
};
