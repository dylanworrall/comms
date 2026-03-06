import { tool } from "ai";
import { z } from "zod";
import { getCalls, getCallById } from "@/lib/stores/calls-store";
import { createApproval } from "@/lib/stores/approvals";

export const callTools = {
  list_calls: tool({
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
    execute: async ({ limit, direction, contactName }) => {
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
  }),

  get_call_transcript: tool({
    description:
      "Get the full transcript and details of a specific call by its ID.",
    inputSchema: z.object({
      id: z.string().describe("The call record ID"),
    }),
    execute: async ({ id }) => {
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
  }),

  initiate_call: tool({
    description:
      "Initiate a phone call to a given number. This creates an approval item — the call is NOT placed until the user approves it.",
    inputSchema: z.object({
      phoneNumber: z.string().describe("The phone number to call"),
      contactName: z
        .string()
        .optional()
        .describe("Name of the person being called (for display)"),
    }),
    execute: async ({ phoneNumber, contactName }) => {
      const displayName = contactName ?? phoneNumber;
      const approval = createApproval("initiate_call", {
        phoneNumber,
        contactName: displayName,
      });
      return {
        message: `Call to ${displayName} (${phoneNumber}) queued for approval (ID: ${approval.id}). The user must approve before the call is placed.`,
        needsApproval: true,
        approvalId: approval.id,
        call: { phoneNumber, contactName: displayName },
      };
    },
  }),
};
