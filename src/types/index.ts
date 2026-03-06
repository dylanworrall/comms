export type { AgentMode, AgentModes, CommsConfig } from "./config.js";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  labels: string[];
}

export interface ApprovalItem {
  id: string;
  type: "send_email" | "add_contact" | "update_contact";
  status: "pending" | "approved" | "rejected";
  data: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ActivityEntry {
  id: string;
  type: "email_sent" | "email_received" | "contact_added" | "approval_resolved";
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
