"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type AgentMode = "auto" | "draft" | "manual";

interface AgentModeContextValue {
  modes: Record<string, AgentMode>;
  setMode: (tool: string, mode: AgentMode) => void;
}

const AgentModeContext = createContext<AgentModeContextValue | null>(null);

const DEFAULT_MODES: Record<string, AgentMode> = {
  search_contacts: "auto",
  add_contact: "auto",
  get_inbox: "auto",
  send_email: "draft",
  summarize_inbox: "auto",
  get_approval_queue: "auto",
  approve_action: "auto",
  get_settings: "auto",
};

export function AgentModeProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState<Record<string, AgentMode>>(DEFAULT_MODES);

  const setMode = useCallback((tool: string, mode: AgentMode) => {
    setModes((prev) => ({ ...prev, [tool]: mode }));
  }, []);

  return (
    <AgentModeContext value={{ modes, setMode }}>
      {children}
    </AgentModeContext>
  );
}

export function useAgentMode(): AgentModeContextValue {
  const ctx = useContext(AgentModeContext);
  if (!ctx) throw new Error("useAgentMode must be used within AgentModeProvider");
  return ctx;
}
