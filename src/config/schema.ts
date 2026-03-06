import { z } from "zod";

const AgentModeSchema = z.enum(["auto", "draft", "manual"]);

const AgentModesSchema = z.object({
  search_contacts: AgentModeSchema,
  add_contact: AgentModeSchema,
  get_inbox: AgentModeSchema,
  send_email: AgentModeSchema,
  summarize_inbox: AgentModeSchema,
  get_approval_queue: AgentModeSchema,
  approve_action: AgentModeSchema,
  get_settings: AgentModeSchema,
}).partial();

export const ConfigFileSchema = z.object({
  anthropicModel: z.string().optional(),
  fromEmail: z.string().email().optional(),
  agentModes: AgentModesSchema.optional(),
  cronEnabled: z.boolean().optional(),
  cronSchedule: z.string().optional(),
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;
