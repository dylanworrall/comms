"use client";

import { cn } from "@/lib/utils";
import { StarIcon } from "lucide-react";

interface EmailPreviewProps {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  flagged: boolean;
  onClick?: (id: string) => void;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts: string) {
  const date = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function EmailPreview({
  id,
  fromName,
  subject,
  preview,
  timestamp,
  read,
  flagged,
  onClick,
  className,
}: EmailPreviewProps) {
  return (
    <div
      onClick={() => onClick?.(id)}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border border-border transition-colors",
        !read ? "bg-surface-1" : "bg-surface-0",
        onClick && "cursor-pointer hover:border-accent/30",
        className
      )}
    >
      {/* Unread dot */}
      <div className="flex flex-col items-center pt-1.5">
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            !read ? "bg-accent" : "bg-transparent"
          )}
        />
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center font-medium text-xs text-muted-foreground flex-shrink-0">
        {getInitials(fromName)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm truncate", !read ? "font-semibold text-foreground" : "text-foreground")}>
            {fromName}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatTime(timestamp)}
          </span>
        </div>
        <div className={cn("text-sm truncate", !read ? "font-medium text-foreground" : "text-muted-foreground")}>
          {subject}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {preview}
        </div>
      </div>

      {/* Flag */}
      {flagged && (
        <StarIcon className="size-3.5 text-approval-amber fill-approval-amber flex-shrink-0 mt-1" />
      )}
    </div>
  );
}
