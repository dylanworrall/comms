import type { CommsConfig } from "../types/index.js";

export const DEFAULT_CONFIG: CommsConfig = {
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-20250514",
  resendApiKey: "",
  fromEmail: "noreply@example.com",
  agentModes: {
    search_contacts: "auto",
    add_contact: "auto",
    get_inbox: "auto",
    send_email: "draft",
    summarize_inbox: "auto",
    get_approval_queue: "auto",
    approve_action: "auto",
    get_settings: "auto",
  },
  cronEnabled: false,
  cronSchedule: "*/5 * * * *",
};
