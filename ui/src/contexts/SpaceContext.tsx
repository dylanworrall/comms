"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface Space {
  id: string;
  name: string;
  description: string;
  tone: string;
}

interface SpaceContextValue {
  spaces: Space[];
  activeSpaceId: string | null;
  activeSpace: Space | null;
  setActiveSpace: (id: string | null) => void;
  refreshSpaces: () => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

const STORAGE_KEY = "comms-active-space";

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const refreshSpaces = useCallback(() => {
    fetch("/api/spaces")
      .then((r) => r.json())
      .then((data) => setSpaces(data.spaces ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveSpaceId(stored);
    refreshSpaces();
  }, [refreshSpaces]);

  const setActiveSpace = useCallback((id: string | null) => {
    setActiveSpaceId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

  return (
    <SpaceContext value={{ spaces, activeSpaceId, activeSpace, setActiveSpace, refreshSpaces }}>
      {children}
    </SpaceContext>
  );
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error("useSpace must be used within SpaceProvider");
  return ctx;
}
