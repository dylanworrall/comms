"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SendIcon, XIcon } from "lucide-react";

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (data: { to: string; cc: string; subject: string; body: string }) => void;
  defaultTo?: string;
  defaultSubject?: string;
}

export function ComposeDialog({
  open,
  onOpenChange,
  onSend,
  defaultTo = "",
  defaultSubject = "",
}: ComposeDialogProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");

  const handleSend = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    onSend({ to, cc, subject, body });
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-surface-1 border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Compose Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Optional"
              className="w-full bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
              className="w-full bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl border-border text-muted-foreground">
              <XIcon className="size-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!to.trim() || !subject.trim() || !body.trim()}
              className="bg-accent hover:bg-accent/90 text-foreground rounded-xl"
            >
              <SendIcon className="size-3.5" />
              Send for Approval
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
