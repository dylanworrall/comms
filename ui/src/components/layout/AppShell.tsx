"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { AgentModeProvider } from "@/contexts/AgentModeContext";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <SpaceProvider>
          <ThreadProvider>
            <AgentModeProvider>
              <Sidebar />
              <MainContent>{children}</MainContent>
            </AgentModeProvider>
          </ThreadProvider>
        </SpaceProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
