"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ComposeDialog } from "@/components/chat/ComposeDialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchIcon,
  RefreshCwIcon,
  MailIcon,
  SettingsIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  StarIcon,
  PenIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
  InboxIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  TagIcon,
  FolderIcon,
  BotIcon,
  UserIcon,
  TrashIcon,
  SendIcon,
  SparklesIcon,
  Loader2Icon as Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  preview: string;
  timestamp: string;
  read: boolean;
  flagged: boolean;
  folder: string;
  tags?: string[];
  priority?: number;
  senderType?: "human" | "auto";
  aiSummary?: string;
  aiDraftReply?: string;
  project?: string;
}

interface GmailStatus {
  connected: boolean;
  accounts: string[];
  defaultAccount: string | null;
}

type GroupBy = "date" | "sender" | "folder";
type SortBy = "time" | "subject" | "sender" | "priority";
type SortDir = "desc" | "asc";
type StatusFilter = "all" | "unread" | "flagged";
type FolderFilter = "all" | "inbox" | "sent" | "drafts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashStringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function avatarColor(name: string): string {
  const hue = hashStringToHue(name);
  return `hsl(${hue}, 55%, 45%)`;
}

function relativeTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDateGroup(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (today.getTime() - emailDay.getTime()) / 86400000
  );

  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  if (diffDays <= 7) return "LAST 7 DAYS";
  if (diffDays <= 30) return "LAST 30 DAYS";
  return "OLDER";
}

function groupEmails(
  emails: Email[],
  groupBy: GroupBy
): { label: string; emails: Email[] }[] {
  const groups = new Map<string, Email[]>();

  for (const email of emails) {
    let key: string;
    switch (groupBy) {
      case "date":
        key = getDateGroup(email.timestamp);
        break;
      case "sender":
        key = email.fromName;
        break;
      case "folder":
        key = email.folder.toUpperCase();
        break;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(email);
  }

  // For date grouping, enforce a specific order
  if (groupBy === "date") {
    const order = ["TODAY", "YESTERDAY", "LAST 7 DAYS", "LAST 30 DAYS", "OLDER"];
    return order
      .filter((label) => groups.has(label))
      .map((label) => ({ label, emails: groups.get(label)! }));
  }

  return Array.from(groups.entries()).map(([label, emails]) => ({
    label,
    emails,
  }));
}

function sortEmails(
  emails: Email[],
  sortBy: SortBy,
  sortDir: SortDir
): Email[] {
  const sorted = [...emails];
  sorted.sort((a, b) => {
    let cmp: number;
    switch (sortBy) {
      case "time":
        cmp =
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case "subject":
        cmp = a.subject.localeCompare(b.subject);
        break;
      case "sender":
        cmp = a.fromName.localeCompare(b.fromName);
        break;
      case "priority":
        cmp = (a.priority ?? 0) - (b.priority ?? 0);
        break;
      default:
        cmp = 0;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

// ---------------------------------------------------------------------------
// Avatar Component
// ---------------------------------------------------------------------------

function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const bg = avatarColor(name);
  const sizeClass = size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-xs";

  return (
    <div
      className={`${sizeClass} rounded-2xl flex items-center justify-center font-semibold text-foreground flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarFilterSection
// ---------------------------------------------------------------------------

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PillToggle
// ---------------------------------------------------------------------------

function PillToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150
            ${
              value === opt.value
                ? "bg-accent/12 text-accent border border-accent/20"
                : "bg-surface-2/40 text-muted-foreground border border-transparent hover:bg-surface-2/60 hover:text-foreground/60"
            }
          `}
        >
          {opt.label}
          {opt.count !== undefined && opt.count > 0 && (
            <span
              className={`ml-1.5 text-[10px] ${
                value === opt.value ? "text-accent/70" : "text-muted-foreground/60"
              }`}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailRow
// ---------------------------------------------------------------------------

function EmailRow({
  email,
  isSelected,
  onClick,
}: {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 border-b border-border/50
        ${isSelected ? "bg-accent/8 border-l-2 border-l-accent" : "border-l-2 border-l-transparent"}
        ${!email.read && !isSelected ? "bg-surface-1/40" : ""}
        hover:bg-surface-2/30
      `}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 self-start mt-0.5">
        <Avatar name={email.fromName} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[13px] truncate ${
              !email.read
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/70"
            }`}
          >
            {email.fromName}
          </span>
          {!email.read && (
            <div className="w-[7px] h-[7px] rounded-full bg-accent flex-shrink-0" />
          )}
          {email.flagged && (
            <StarIcon className="size-3.5 text-accent-amber fill-accent-amber flex-shrink-0" />
          )}
          <span className="flex-shrink-0 text-[11px] text-muted-foreground/70 tabular-nums ml-auto">
            {relativeTime(email.timestamp)}
          </span>
        </div>
        <div
          className={`text-[13px] truncate mt-0.5 ${
            !email.read
              ? "font-medium text-foreground/85"
              : "text-muted-foreground"
          }`}
        >
          {email.subject}
        </div>
        <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {email.aiSummary || email.preview}
        </div>
        {/* AI tags & priority */}
        {(email.tags?.length || email.priority != null) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {email.priority != null && email.priority !== 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                email.priority >= 8 ? "bg-destructive/12 text-destructive" :
                email.priority >= 4 ? "bg-accent-amber/12 text-accent-amber" :
                email.priority > 0 ? "bg-success/12 text-success" :
                "bg-surface-2 text-muted-foreground/50"
              }`}>
                {email.priority > 0 ? "+" : ""}{email.priority} pts
              </span>
            )}
            {email.senderType === "auto" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-muted-foreground/60">
                Auto
              </span>
            )}
            {email.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/8 text-accent/70">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailDetail
// ---------------------------------------------------------------------------

function EmailDetail({
  email,
  onClose,
  onMarkRead,
  onMarkUnread,
  onToggleFlag,
  onDelete,
}: {
  email: Email;
  onClose: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onToggleFlag: () => void;
  onDelete: () => void;
}) {
  const [replyDraft, setReplyDraft] = useState("");
  const [polishedReply, setPolishedReply] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [replyDraft]);

  // Pre-fill with AI draft reply if available
  useEffect(() => {
    if (email.aiDraftReply) {
      setPolishedReply(email.aiDraftReply);
    } else {
      setPolishedReply("");
    }
    setReplyDraft("");
    setSent(false);
  }, [email.id, email.aiDraftReply]);

  const polishReply = async () => {
    if (!replyDraft.trim()) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `You are a professional email writing assistant. Take the user's rough draft and turn it into a polished, professional email reply. Keep their intent and tone but make it clear and well-written. Do NOT add a subject line. Do NOT include "Dear" or overly formal greetings — keep it natural. Output ONLY the polished email body text, nothing else.

Context — this is a reply to:
From: ${email.fromName} <${email.from}>
Subject: ${email.subject}
Body: ${email.body.slice(0, 500)}

User's rough draft:
${replyDraft}`,
            },
          ],
        }),
      });
      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Parse SSE data lines for text deltas
          for (const line of chunk.split("\n")) {
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2));
                fullText += text;
                setPolishedReply(fullText);
              } catch { /* skip non-JSON lines */ }
            }
          }
        }
      }
    } catch {
      setPolishedReply("Failed to polish reply. Try again.");
    }
    setPolishing(false);
  };

  const sendReply = async () => {
    const body = polishedReply || replyDraft;
    if (!body.trim()) return;
    setSending(true);
    try {
      await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compose",
          to: email.from,
          cc: "",
          subject: `Re: ${email.subject.replace(/^Re:\s*/i, "")}`,
          body,
        }),
      });
      setSent(true);
      setReplyDraft("");
      setPolishedReply("");
    } catch { /* silent */ }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Detail Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="text-xs">Back</span>
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleFlag}
            className={
              email.flagged
                ? "text-accent-amber hover:text-accent-amber/80"
                : "text-muted-foreground hover:text-accent-amber"
            }
            title={email.flagged ? "Unflag" : "Flag"}
          >
            <StarIcon className={`size-4 ${email.flagged ? "fill-accent-amber" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={email.read ? onMarkUnread : onMarkRead}
            className="text-muted-foreground hover:text-accent"
            title={email.read ? "Mark as unread" : "Mark as read"}
          >
            {email.read ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Detail Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="px-6 py-5 overflow-hidden max-w-3xl">
          {/* Subject */}
          <h2 className="text-lg font-semibold text-foreground mb-4 leading-snug break-words tracking-tight">
            {email.subject}
          </h2>

          {/* Sender info */}
          <div className="flex items-start gap-3 mb-5">
            <Avatar name={email.fromName} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{email.fromName}</span>
                <span className="text-xs text-muted-foreground/70">
                  {new Date(email.timestamp).toLocaleDateString([], {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                  })}{" "}at{" "}
                  {new Date(email.timestamp).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground/70 mt-0.5">{email.from}</div>
              <div className="text-xs text-muted-foreground/50 mt-0.5">
                To: {email.to}
                {email.cc && <span> &middot; CC: {email.cc}</span>}
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {email.aiSummary && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-accent/[0.06] border border-accent/10">
              <div className="text-[10px] font-semibold text-accent/50 uppercase tracking-wider mb-1">AI Summary</div>
              <div className="text-sm text-foreground/70 leading-relaxed">{email.aiSummary}</div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border mb-5" />

          {/* Email body */}
          {email.bodyHtml ? (
            <iframe
              sandbox="allow-same-origin"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#e0e0e0;background:transparent;word-break:break-word;overflow-wrap:anywhere}a{color:#0A84FF}img{max-width:100%;height:auto}table{max-width:100%!important}*{max-width:100%!important;box-sizing:border-box}</style></head><body>${email.bodyHtml}</body></html>`}
              className="w-full border-0"
              style={{ minHeight: "300px", background: "transparent" }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                if (iframe.contentDocument?.body) {
                  iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + "px";
                }
              }}
            />
          ) : (
            <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {email.body}
            </div>
          )}
        </div>
      </div>

      {/* AI Reply Box */}
      <div className="border-t border-border px-5 py-4 flex-shrink-0 space-y-3">
        {sent ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/8 border border-success/15">
            <CheckCircle2Icon className="size-4 text-success" />
            <span className="text-sm text-success">Reply queued for approval</span>
          </div>
        ) : (
          <>
            {/* Rough draft input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={`Type your rough reply to ${email.fromName}... AI will polish it`}
                rows={2}
                className="w-full bg-surface-2/40 rounded-xl px-4 py-3 pr-24 text-sm text-foreground border border-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/20 resize-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    e.preventDefault();
                    polishReply();
                  }
                }}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={polishReply}
                  disabled={!replyDraft.trim() || polishing}
                  className="text-accent hover:text-accent/80"
                  title="Polish with AI (Cmd+Enter)"
                >
                  {polishing ? <Loader2 className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                </Button>
              </div>
            </div>

            {/* Polished preview */}
            {polishedReply && (
              <div className="rounded-xl bg-surface-1 border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-surface-2/30">
                  <SparklesIcon className="size-3 text-accent/50" />
                  <span className="text-[10px] font-semibold text-accent/50 uppercase tracking-wider">AI Polished Reply</span>
                </div>
                <div className="px-4 py-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                  {polishedReply}
                </div>
              </div>
            )}

            {/* Send button */}
            {(polishedReply || replyDraft.trim()) && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={sendReply}
                  disabled={sending}
                  className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl"
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
                  {polishedReply ? "Send Polished Reply" : "Send Raw Reply"}
                </Button>
                {polishedReply && (
                  <button
                    onClick={() => {
                      setReplyDraft(polishedReply);
                      setPolishedReply("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground/60 transition-colors"
                  >
                    Edit polished text
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                  Goes to approval queue
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InboxPage() {
  // Data state
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);

  // Filter / sort state
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [sortBy, setSortBy] = useState<SortBy>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [senderFilter, setSenderFilter] = useState<"all" | "human" | "auto">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Projects from AI settings
  const [projects, setProjects] = useState<{ id: string; name: string; emoji: string; domain: string }[]>([]);

  // UI state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [replyTo, setReplyTo] = useState<Email | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox?limit=200");
      const data = await res.json();
      setEmails(data.emails ?? []);
      setLastSyncTime(new Date());
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  const fetchGmailStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gmail/status");
      const data = await res.json();
      setGmailStatus(data);
    } catch {
      // silently fail
    }
  }, []);

  const syncGmail = useCallback(
    async (account?: string) => {
      setSyncing(true);
      try {
        await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, limit: 30 }),
        });
        await fetchEmails();
      } catch {
        // silently fail
      }
      setSyncing(false);
    },
    [fetchEmails]
  );

  const handleMarkRead = useCallback(
    async (id: string) => {
      await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, read: true } : e))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) => (prev ? { ...prev, read: true } : null));
      }
    },
    [selectedEmail]
  );

  const handleMarkUnread = useCallback(
    (id: string) => {
      // Optimistic update only (no API endpoint for unread yet)
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, read: false } : e))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) => (prev ? { ...prev, read: false } : null));
      }
    },
    [selectedEmail]
  );

  const handleToggleFlag = useCallback(
    (id: string) => {
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, flagged: !e.flagged } : e))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) =>
          prev ? { ...prev, flagged: !prev.flagged } : null
        );
      }
    },
    [selectedEmail]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
      }
    },
    [selectedEmail]
  );

  const handleComposeSend = async (data: {
    to: string;
    cc: string;
    subject: string;
    body: string;
  }) => {
    await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "compose", ...data }),
    });
    fetchEmails();
  };

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-settings");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchEmails();
    fetchGmailStatus();
    fetchProjects();
  }, [fetchEmails, fetchGmailStatus, fetchProjects]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const counts = useMemo(() => {
    const unread = emails.filter((e) => !e.read).length;
    const flagged = emails.filter((e) => e.flagged).length;
    const inbox = emails.filter((e) => e.folder === "inbox").length;
    const sent = emails.filter((e) => e.folder === "sent").length;
    const drafts = emails.filter((e) => e.folder === "drafts").length;
    const human = emails.filter((e) => e.senderType === "human").length;
    const auto = emails.filter((e) => e.senderType === "auto").length;

    // Tag counts
    const tagCounts: Record<string, number> = {};
    for (const e of emails) {
      for (const t of e.tags ?? []) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    // Project counts — match emails to projects by domain or project field
    const projectCounts: Record<string, number> = {};
    for (const e of emails) {
      // Check if email has an AI-assigned project
      if (e.project) {
        projectCounts[e.project] = (projectCounts[e.project] || 0) + 1;
        continue;
      }
      // Otherwise match by project domain config
      for (const p of projects) {
        if (p.domain && (e.from.includes(p.domain) || e.to.includes(p.domain))) {
          projectCounts[p.name] = (projectCounts[p.name] || 0) + 1;
          break;
        }
      }
    }

    return { unread, flagged, inbox, sent, drafts, human, auto, total: emails.length, tagCounts, projectCounts };
  }, [emails, projects]);

  const filteredEmails = useMemo(() => {
    let result = [...emails];

    // Status filter
    if (statusFilter === "unread") result = result.filter((e) => !e.read);
    if (statusFilter === "flagged") result = result.filter((e) => e.flagged);

    // Folder filter
    if (folderFilter !== "all")
      result = result.filter((e) => e.folder === folderFilter);

    // Sender type filter
    if (senderFilter !== "all") result = result.filter((e) => e.senderType === senderFilter);

    // Tag filter
    if (tagFilter) result = result.filter((e) => e.tags?.includes(tagFilter));

    // Project filter
    if (projectFilter) {
      result = result.filter((e) => {
        if (e.project === projectFilter) return true;
        const proj = projects.find((p) => p.name === projectFilter);
        if (proj?.domain) return e.from.includes(proj.domain) || e.to.includes(proj.domain);
        return false;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.fromName.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q)
      );
    }

    // Sort
    result = sortEmails(result, sortBy, sortDir);

    return result;
  }, [emails, statusFilter, folderFilter, senderFilter, tagFilter, projectFilter, projects, searchQuery, sortBy, sortDir]);

  const groupedEmails = useMemo(
    () => groupEmails(filteredEmails, groupBy),
    [filteredEmails, groupBy]
  );

  const syncAgoText = useMemo(() => {
    if (!lastSyncTime) return "NOT SYNCED";
    const mins = minutesAgo(lastSyncTime);
    if (mins < 1) return "SYNCED JUST NOW";
    return `SYNCED ${mins} MIN AGO`;
  }, [lastSyncTime]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* ================================================================= */}
      {/* LEFT SIDEBAR */}
      {/* ================================================================= */}
      <div
        className={`
          ${sidebarOpen ? "w-[320px] min-w-[280px]" : "w-0 min-w-0 overflow-hidden"}
          flex-shrink-0 border-r border-border bg-surface-0 transition-all duration-200 flex flex-col
          max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30
          ${sidebarOpen ? "max-md:w-[300px]" : "max-md:w-0"}
        `}
      >
        {/* Sidebar Header */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          {/* Unread count + sync status */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
                {counts.unread}
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                unread
              </span>
            </div>
            <div className="text-[10px] tracking-[0.12em] text-muted-foreground/50 font-medium mt-1">
              {syncAgoText}
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) setSearchQuery("");
              }}
              className={`text-muted-foreground hover:text-foreground/60 ${showSearch ? "text-accent" : ""}`}
              title="Search"
            >
              <SearchIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => fetchEmails()}
              className="text-muted-foreground hover:text-foreground/60"
              title="Refresh"
            >
              <RefreshCwIcon
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            {gmailStatus?.connected && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => syncGmail()}
                className="text-muted-foreground hover:text-foreground/60"
                title="Sync Gmail"
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <MailIcon className="size-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground/60"
              title="Settings"
              onClick={() =>
                (window.location.href = "/settings")
              }
            >
              <SettingsIcon className="size-4" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground/60 md:hidden"
              title="Close sidebar"
            >
              <PanelLeftCloseIcon className="size-4" />
            </Button>
          </div>

          {/* Search input */}
          {showSearch && (
            <div className="mt-3 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="w-full bg-surface-2/40 rounded-xl pl-9 pr-8 py-2 text-sm text-foreground border border-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Filters — Kitze LifeOS-style layout */}
        <ScrollArea className="flex-1 px-5">
          <div className="space-y-5 pb-5">
            {/* GROUP BY + SORT — side by side */}
            <div className="flex gap-3">
              <FilterSection label="Group By">
                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy(v as GroupBy)}
                >
                  <SelectTrigger size="sm" className="w-full bg-surface-2/40 border-border text-foreground/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="sender">Sender</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </FilterSection>
              <FilterSection label="Sort">
                <div className="flex items-center gap-1">
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as SortBy)}
                  >
                    <SelectTrigger size="sm" className="flex-1 bg-surface-2/40 border-border text-foreground/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="subject">Subject</SelectItem>
                      <SelectItem value="sender">Sender</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="text-muted-foreground hover:text-foreground/60 flex-shrink-0"
                    title={sortDir === "asc" ? "Ascending" : "Descending"}
                  >
                    {sortDir === "asc" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}
                  </Button>
                </div>
              </FilterSection>
            </div>

            {/* SENDER — pill toggles with colored count badges */}
            <FilterSection label="Sender">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSenderFilter("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    senderFilter === "all"
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground/60"
                  }`}
                >
                  <UserIcon className="size-3.5" />
                  All
                </button>
                <button
                  onClick={() => setSenderFilter("human")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    senderFilter === "human"
                      ? "bg-success/12 text-success"
                      : "text-muted-foreground hover:text-foreground/60"
                  }`}
                >
                  <UserIcon className="size-3.5" />
                  Human
                  {counts.human > 0 && (
                    <span className="bg-success text-black text-[10px] font-bold rounded-full px-1.5 min-w-[20px] text-center">
                      {counts.human}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSenderFilter("auto")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    senderFilter === "auto"
                      ? "bg-destructive/12 text-destructive"
                      : "text-muted-foreground hover:text-foreground/60"
                  }`}
                >
                  <BotIcon className="size-3.5" />
                  Auto
                  {counts.auto > 0 && (
                    <span className="bg-destructive text-white text-[10px] font-bold rounded-full px-1.5 min-w-[20px] text-center">
                      {counts.auto}
                    </span>
                  )}
                </button>
              </div>
            </FilterSection>

            {/* FOLDER — pill row */}
            <FilterSection label="Folder">
              <div className="flex items-center gap-2">
                {([
                  { value: "all", label: "All", count: counts.total },
                  { value: "inbox", label: "Inbox", count: counts.inbox },
                  { value: "sent", label: "Sent", count: counts.sent },
                  { value: "drafts", label: "Drafts", count: counts.drafts },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFolderFilter(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      folderFilter === opt.value
                        ? "bg-accent/12 text-accent"
                        : "text-muted-foreground hover:text-foreground/60"
                    }`}
                  >
                    {opt.label}
                    {opt.count > 0 && (
                      <span className={`text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center ${
                        folderFilter === opt.value
                          ? "bg-accent text-accent-foreground"
                          : "bg-surface-2 text-muted-foreground/70"
                      }`}>
                        {opt.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* PROJECTS — user-defined projects (Resend domains, products, etc.) */}
            {projects.length > 0 && (
              <FilterSection label="Projects">
                <div className="space-y-0.5">
                  <button
                    onClick={() => setProjectFilter(null)}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-colors text-left ${
                      projectFilter === null ? "bg-surface-2 text-foreground" : "hover:bg-surface-2/50 text-muted-foreground"
                    }`}
                  >
                    <FolderIcon className="size-4 text-muted-foreground/60 flex-shrink-0" />
                    <span className="text-sm flex-1">All Projects</span>
                  </button>
                  {projects.map((proj) => {
                    const count = counts.projectCounts[proj.name] ?? 0;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => setProjectFilter(projectFilter === proj.name ? null : proj.name)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-colors text-left ${
                          projectFilter === proj.name
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-surface-2/50 text-foreground/60"
                        }`}
                      >
                        <span className="text-base flex-shrink-0 w-5 text-center">{proj.emoji || "📦"}</span>
                        <span className="text-sm truncate flex-1">{proj.name}</span>
                        {count > 0 && (
                          <span className="text-xs text-muted-foreground/60 tabular-nums">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {/* TAGS — with counts */}
            {Object.keys(counts.tagCounts).length > 0 && (
              <FilterSection label="Tags">
                <div className="space-y-0.5">
                  {Object.entries(counts.tagCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([tag, count]) => (
                      <button
                        key={tag}
                        onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-colors text-left ${
                          tagFilter === tag
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-surface-2/50 text-foreground/60"
                        }`}
                      >
                        <TagIcon className="size-3.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="text-sm truncate flex-1">{tag}</span>
                        <span className="text-xs text-muted-foreground/60">({count})</span>
                      </button>
                    ))}
                </div>
              </FilterSection>
            )}

            {/* ACCOUNTS */}
            {gmailStatus && gmailStatus.accounts?.length > 0 && (
              <FilterSection label="Accounts">
                <div className="space-y-1">
                  {gmailStatus.accounts.map((account) => (
                    <div
                      key={account}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-surface-2/30 border border-border"
                    >
                      <div className="w-6 h-6 rounded-lg bg-accent/12 flex items-center justify-center flex-shrink-0">
                        <MailIcon className="size-3 text-accent" />
                      </div>
                      <span className="text-xs text-foreground/60 truncate flex-1">
                        {account}
                      </span>
                      <button
                        onClick={() => syncGmail(account)}
                        disabled={syncing}
                        className="text-muted-foreground/50 hover:text-accent transition-colors flex-shrink-0"
                        title={`Sync ${account}`}
                      >
                        <RefreshCwIcon className={`size-3 ${syncing ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </FilterSection>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ================================================================= */}
      {/* MAIN PANEL */}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with sidebar toggle (mobile) + result count */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 flex-shrink-0 bg-background">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground/60"
              title="Open sidebar"
            >
              <PanelLeftOpenIcon className="size-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <InboxIcon className="size-4 text-muted-foreground/60" />
            <span className="text-sm text-muted-foreground">
              {filteredEmails.length}{" "}
              {filteredEmails.length === 1 ? "email" : "emails"}
              {searchQuery && (
                <span className="text-muted-foreground/60">
                  {" "}
                  matching &ldquo;{searchQuery}&rdquo;
                </span>
              )}
            </span>
          </div>
          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-muted-foreground hover:text-foreground/60"
          >
            <PanelLeftOpenIcon className="size-4" />
          </Button>
        </div>

        {/* Content area: list OR detail (full width swap like Gmail) */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onMarkRead={() => handleMarkRead(selectedEmail.id)}
              onMarkUnread={() => handleMarkUnread(selectedEmail.id)}
              onToggleFlag={() => handleToggleFlag(selectedEmail.id)}
              onDelete={() => handleDelete(selectedEmail.id)}
            />
          ) : loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="w-10 h-10 rounded-2xl shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded-lg shimmer" />
                    <div className="h-3 w-48 rounded-lg shimmer" />
                    <div className="h-2.5 w-64 rounded-lg shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-surface-2/40 flex items-center justify-center mx-auto mb-4">
                  {searchQuery ? (
                    <SearchIcon className="size-7 text-muted-foreground/30" />
                  ) : statusFilter === "unread" ? (
                    <CheckCircle2Icon className="size-7 text-accent/30" />
                  ) : (
                    <InboxIcon className="size-7 text-muted-foreground/30" />
                  )}
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {searchQuery
                    ? "No emails match your search"
                    : statusFilter === "unread"
                      ? "All caught up"
                      : "No emails yet"}
                </p>
                <p className="text-xs text-muted-foreground/50 mt-1.5">
                  {searchQuery
                    ? "Try a different search term"
                    : statusFilter === "unread"
                      ? "You have no unread emails"
                      : "Emails will appear here when synced"}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              {groupedEmails.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 px-4 py-2 bg-background/90 backdrop-blur-md border-b border-border/30">
                    <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/60 uppercase">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/30 ml-2">
                      {group.emails.length}
                    </span>
                  </div>
                  {group.emails.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      isSelected={false}
                      onClick={() => {
                        setSelectedEmail(email);
                        if (!email.read) handleMarkRead(email.id);
                      }}
                    />
                  ))}
                </div>
              ))}
            </ScrollArea>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* COMPOSE FAB */}
      {/* ================================================================= */}
      <button
        onClick={() => {
          setReplyTo(null);
          setShowCompose(true);
        }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all hover:scale-105 active:scale-95"
        title="Compose"
      >
        <PenIcon className="size-5" />
      </button>

      {/* ================================================================= */}
      {/* COMPOSE DIALOG */}
      {/* ================================================================= */}
      <ComposeDialog
        open={showCompose}
        onOpenChange={(open) => {
          setShowCompose(open);
          if (!open) setReplyTo(null);
        }}
        onSend={handleComposeSend}
        defaultTo={replyTo?.from ?? ""}
        defaultSubject={
          replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : ""
        }
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
