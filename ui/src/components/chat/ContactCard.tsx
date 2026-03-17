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
    "bg-[#0A84FF]/15 text-[#0A84FF]",
    "bg-[#BF5AF2]/15 text-[#BF5AF2]",
    "bg-[#30D158]/15 text-[#30D158]",
    "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    "bg-[#FF453A]/15 text-[#FF453A]",
    "bg-[#5E5CE6]/15 text-[#5E5CE6]",
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
        "p-4 rounded-2xl bg-surface-1 border border-border hover:border-foreground/15 transition-all",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center font-semibold text-sm flex-shrink-0",
            getAvatarColor(name)
          )}
        >
          {getInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">{name}</div>
          <div className="text-xs text-foreground/40 truncate">{email}</div>
          {company && (
            <div className="text-xs text-foreground/30 mt-0.5">{company}</div>
          )}
        </div>
      </div>
      {phone && (
        <div className="text-xs text-foreground/30 mt-2">{phone}</div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-surface-2/60 text-foreground/50 border-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {lastContacted && (
        <div className="text-[10px] text-foreground/20 mt-2">
          Last contacted: {new Date(lastContacted).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
