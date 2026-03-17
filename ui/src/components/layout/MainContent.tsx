"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  // Sidebar: left-3 (12px) + width (w-16=64px or w-56=224px) + gap (12px)
  // Collapsed: 12 + 64 + 12 = 88px → ml-[88px]
  // Expanded:  12 + 224 + 12 = 248px → ml-[248px]
  return (
    <main
      className={cn(
        "min-h-screen transition-[margin-left] duration-300 overflow-hidden",
        collapsed ? "ml-[88px]" : "ml-[248px]"
      )}
      style={{ maxWidth: collapsed ? "calc(100vw - 88px)" : "calc(100vw - 248px)" }}
    >
      {children}
    </main>
  );
}
