"use client";

import { cn } from "@/lib/utils";
import { PhoneIncomingIcon, PhoneOutgoingIcon, PhoneMissedIcon, VoicemailIcon } from "lucide-react";

interface CallLogEntryProps {
  id: string;
  contactName: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail";
  duration: number;
  timestamp: string;
  onClick?: (id: string) => void;
  className?: string;
}

function formatDuration(seconds: number) {
  if (seconds === 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
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

function getIcon(direction: string, status: string) {
  if (status === "missed") return <PhoneMissedIcon className="size-4 text-destructive" />;
  if (status === "voicemail") return <VoicemailIcon className="size-4 text-approval-amber" />;
  if (direction === "inbound") return <PhoneIncomingIcon className="size-4 text-green-400" />;
  return <PhoneOutgoingIcon className="size-4 text-accent" />;
}

export function CallLogEntry({
  id,
  contactName,
  phoneNumber,
  direction,
  status,
  duration,
  timestamp,
  onClick,
  className,
}: CallLogEntryProps) {
  return (
    <div
      onClick={() => onClick?.(id)}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-surface-1 border border-border transition-colors",
        onClick && "cursor-pointer hover:border-accent/30",
        className
      )}
    >
      <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
        {getIcon(direction, status)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {contactName}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatTime(timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{phoneNumber}</span>
          <span>·</span>
          <span>{formatDuration(duration)}</span>
          {status !== "completed" && (
            <>
              <span>·</span>
              <span className={cn(
                status === "missed" ? "text-destructive" : "text-approval-amber"
              )}>
                {status}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
