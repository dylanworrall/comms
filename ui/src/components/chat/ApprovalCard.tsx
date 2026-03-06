"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon, MailIcon, UserPlusIcon, PhoneIcon, ReplyIcon } from "lucide-react";

interface ApprovalCardProps {
  id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  data: Record<string, unknown>;
  createdAt: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  className?: string;
}

const typeIcons: Record<string, typeof MailIcon> = {
  send_email: MailIcon,
  reply_to_email: ReplyIcon,
  add_contact: UserPlusIcon,
  update_contact: UserPlusIcon,
  initiate_call: PhoneIcon,
};

const statusColors: Record<string, string> = {
  pending: "text-approval-amber",
  approved: "text-green-500",
  rejected: "text-destructive",
};

export function ApprovalCard({
  id,
  type,
  status,
  data,
  createdAt,
  onApprove,
  onReject,
  className,
}: ApprovalCardProps) {
  const Icon = typeIcons[type] ?? MailIcon;

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-1 p-4 space-y-3",
        status === "pending" ? "border-approval-amber/30" : "border-border",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-accent" />
          <span className="font-medium text-sm">{type.replace(/_/g, " ")}</span>
          <Badge
            variant={status === "pending" ? "outline" : "secondary"}
            className={cn("capitalize", statusColors[status])}
          >
            {status}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(createdAt).toLocaleString()}
        </span>
      </div>

      {/* Email preview */}
      {(type === "send_email" || type === "reply_to_email") && (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">To: </span>
            <span>{String(data.to ?? "")}</span>
          </div>
          {Boolean(data.subject) && (
            <div>
              <span className="text-muted-foreground">Subject: </span>
              <span>{String(data.subject)}</span>
            </div>
          )}
          {Boolean(data.body) && (
            <div className="mt-2 rounded-lg bg-surface-2 p-3 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
              {String(data.body)}
            </div>
          )}
        </div>
      )}

      {/* Call preview */}
      {type === "initiate_call" && (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Contact: </span>
            <span>{String(data.contactName ?? "Unknown")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Phone: </span>
            <span>{String(data.phoneNumber ?? "")}</span>
          </div>
        </div>
      )}

      {/* Contact preview */}
      {(type === "add_contact" || type === "update_contact") && (
        <div className="space-y-1 text-sm">
          {Boolean(data.name) && (
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span>{String(data.name)}</span>
            </div>
          )}
          {Boolean(data.email) && (
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span>{String(data.email)}</span>
            </div>
          )}
        </div>
      )}

      {status === "pending" && onApprove && onReject && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onApprove(id)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckIcon className="size-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(id)}
          >
            <XIcon className="size-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
