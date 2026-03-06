export type AgentMode = "auto" | "draft" | "manual";

export interface AgentModes {
  search_contacts: AgentMode;
  add_contact: AgentMode;
  get_inbox: AgentMode;
  send_email: AgentMode;
  summarize_inbox: AgentMode;
  get_approval_queue: AgentMode;
  approve_action: AgentMode;
  get_settings: AgentMode;
}

export interface CommsConfig {
  anthropicApiKey: string;
  anthropicModel: string;
  resendApiKey: string;
  fromEmail: string;
  agentModes: AgentModes;
  cronEnabled: boolean;
  cronSchedule: string;
}
