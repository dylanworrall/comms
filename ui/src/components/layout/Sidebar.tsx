"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  MessageSquareIcon,
  UsersIcon,
  MailIcon,
  ShieldCheckIcon,
  PhoneIcon,
  SettingsIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquareIcon },
  { href: "/contacts", label: "Contacts", icon: UsersIcon },
  { href: "/inbox", label: "Inbox", icon: MailIcon },
  { href: "/approvals", label: "Approvals", icon: ShieldCheckIcon, badge: true },
  { href: "/calls", label: "Calls", icon: PhoneIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const expanded = !collapsed || hovered;

  useEffect(() => {
    fetch("/api/approvals?status=pending")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.approvals?.length ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <aside
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed left-3 top-3 bottom-3 bg-surface-1 border border-border rounded-xl flex flex-col transition-[width] duration-300 z-50 shadow-elevation-2 overflow-hidden",
        expanded ? "w-56" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-accent font-bold text-sm">C</span>
        </div>
        {expanded && (
          <span className="font-semibold text-foreground text-sm truncate">
            Comms
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              )}
            >
              <Icon className="size-5 flex-shrink-0" />
              {expanded && <span className="truncate">{label}</span>}
              {badge && pendingCount > 0 && (
                <span
                  className={cn(
                    "bg-approval-amber text-black text-[10px] font-bold rounded-full flex items-center justify-center",
                    expanded
                      ? "ml-auto px-1.5 min-w-[20px] h-5"
                      : "absolute -top-1 -right-1 w-4 h-4 text-[9px]"
                  )}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-border">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors w-full cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-5 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftCloseIcon className="size-5 flex-shrink-0" />
              {expanded && <span>Collapse</span>}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
