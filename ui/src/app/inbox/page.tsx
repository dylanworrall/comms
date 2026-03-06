"use client";

import { useState, useEffect, useCallback } from "react";
import { EmailPreview } from "@/components/chat/EmailPreview";
import { ComposeDialog } from "@/components/chat/ComposeDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MailIcon,
  PenIcon,
  RefreshCwIcon,
  ReplyIcon,
  ForwardIcon,
  ArrowLeftIcon,
} from "lucide-react";

interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  preview: string;
  timestamp: string;
  read: boolean;
  flagged: boolean;
  folder: string;
}

type Tab = "all" | "unread" | "flagged" | "sent";

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab === "unread") params.set("unreadOnly", "true");
    if (tab === "flagged") params.set("flagged", "true");
    if (tab === "sent") params.set("folder", "sent");
    const res = await fetch(`/api/inbox?${params}`);
    const data = await res.json();
    setEmails(data.emails ?? []);
    setUnreadCount(data.unreadCount ?? 0);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

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

  const handleMarkRead = async (id: string) => {
    await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", id }),
    });
    const email = emails.find((e) => e.id === id);
    if (email) {
      setSelectedEmail({ ...email, read: true });
    }
    fetchEmails();
  };

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread", count: unreadCount },
    { value: "flagged", label: "Flagged" },
    { value: "sent", label: "Sent" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MailIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold">Inbox</h1>
          {unreadCount > 0 && (
            <Badge className="bg-accent text-white">{unreadCount} unread</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={fetchEmails}>
            <RefreshCwIcon className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)}>
            <PenIcon className="size-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.value)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                {t.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Email List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-lg shimmer" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MailIcon className="size-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No emails found</p>
          <p className="text-sm mt-1">
            {tab === "unread"
              ? "You're all caught up!"
              : "Emails will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <EmailPreview
              key={email.id}
              {...email}
              onClick={(id) => {
                const e = emails.find((em) => em.id === id);
                if (e) {
                  setSelectedEmail(e);
                  if (!e.read) handleMarkRead(id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Email Detail Dialog */}
      <Dialog
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      >
        <DialogContent className="sm:max-w-[600px] bg-surface-1 border-border max-h-[80vh] overflow-y-auto">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground text-lg">
                  {selectedEmail.subject}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{selectedEmail.fromName}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedEmail.from}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(selectedEmail.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  To: {selectedEmail.to}
                  {selectedEmail.cc && ` | CC: ${selectedEmail.cc}`}
                </div>
                <div className="border-t border-border pt-4">
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {selectedEmail.body}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm">
                    <ReplyIcon className="size-3.5" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm">
                    <ForwardIcon className="size-3.5" />
                    Forward
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <ComposeDialog
        open={showCompose}
        onOpenChange={setShowCompose}
        onSend={handleComposeSend}
      />
    </div>
  );
}
