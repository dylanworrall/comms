import { z } from "zod";
import { getAllSpaces, getSpaceById, createSpace } from "@/lib/stores/spaces-store";

export const listSpacesTool = {
  name: "list_spaces",
  description:
    "List all communication presets/spaces. Spaces define tone, templates, and behavior for different communication contexts (e.g., Sales, Support, Personal).",
  inputSchema: z.object({}),
  execute: async () => {
    const spaces = getAllSpaces();
    if (spaces.length === 0) {
      return { message: "No spaces found.", spaces: [] };
    }
    return {
      message: `${spaces.length} space(s) available`,
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        tone: s.tone,
        templateCount: s.templates.length,
        createdAt: s.createdAt,
      })),
    };
  },
};

export const getSpaceTool = {
  name: "get_space",
  description:
    "Get a single space by its ID with full details including templates, tone, signature, and settings.",
  inputSchema: z.object({
    id: z.string().describe("The space ID"),
  }),
  execute: async ({ id }: { id: string }) => {
    const space = getSpaceById(id);
    if (!space) {
      return { message: `No space found with ID "${id}"` };
    }
    return {
      message: `Space: ${space.name}`,
      space,
    };
  },
};

export const createSpaceTool = {
  name: "create_space",
  description:
    "Create a new communication space with a name, description, tone, email signature, templates, and auto-approve settings.",
  inputSchema: z.object({
    name: z.string().describe("Space name (e.g., Sales Outreach, Support)"),
    description: z.string().describe("What this space is used for"),
    tone: z
      .string()
      .describe("Tone instructions for AI when composing in this space"),
    defaultRecipients: z
      .array(z.string())
      .default([])
      .describe("Default recipient email addresses"),
    emailSignature: z
      .string()
      .default("")
      .describe("Email signature to append"),
    templates: z
      .array(
        z.object({
          name: z.string().describe("Template name"),
          subject: z.string().describe("Email subject template (supports {{placeholders}})"),
          body: z.string().describe("Email body template (supports {{placeholders}})"),
        })
      )
      .default([])
      .describe("Email templates for this space"),
    autoApprove: z
      .array(z.string())
      .default([])
      .describe("Tool names that skip the approval queue in this space"),
  }),
  execute: async (data: {
    name: string;
    description: string;
    tone: string;
    defaultRecipients: string[];
    emailSignature: string;
    templates: { name: string; subject: string; body: string }[];
    autoApprove: string[];
  }) => {
    const space = createSpace(data);
    return {
      message: `Space created: "${space.name}" (ID: ${space.id})`,
      space,
    };
  },
};
