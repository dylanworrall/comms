"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ThreadContextValue {
  chatThreadId: string;
  activeThreadId: string | null;
  setActiveThread: (id: string | null) => void;
  newChat: () => void;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [chatThreadId, setChatThreadId] = useState(() => crypto.randomUUID());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const newChat = useCallback(() => {
    setChatThreadId(crypto.randomUUID());
    setActiveThreadId(null);
  }, []);

  const setActiveThread = useCallback((id: string | null) => {
    setActiveThreadId(id);
  }, []);

  return (
    <ThreadContext value={{ chatThreadId, activeThreadId, setActiveThread, newChat }}>
      {children}
    </ThreadContext>
  );
}

export function useThread(): ThreadContextValue {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error("useThread must be used within ThreadProvider");
  return ctx;
}
