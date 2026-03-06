"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContactCardProps {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  lastContacted?: string;
  avatar?: string;
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

function getAvatarColor(name: string) {
  const colors = [
    "bg-cyan-500/20 text-cyan-400",
    "bg-purple-500/20 text-purple-400",
    "bg-green-500/20 text-green-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-blue-500/20 text-blue-400",
  ];
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function ContactCard({
  id,
  name,
  email,
  phone,
  company,
  tags,
  lastContacted,
  onClick,
  className,
}: ContactCardProps) {
  return (
    <div
      onClick={() => onClick?.(id)}
      className={cn(
        "p-4 rounded-xl bg-surface-1 border border-border hover:border-accent/30 transition-colors",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0",
            getAvatarColor(name)
          )}
        >
          {getInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
          {company && (
            <div className="text-xs text-muted-foreground mt-0.5">{company}</div>
          )}
        </div>
      </div>
      {phone && (
        <div className="text-xs text-muted-foreground mt-2">{phone}</div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {lastContacted && (
        <div className="text-[10px] text-muted-foreground mt-2">
          Last contacted: {new Date(lastContacted).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
