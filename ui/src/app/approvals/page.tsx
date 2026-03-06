"use client";

import { useState, useEffect, useCallback } from "react";
import { ApprovalCard } from "@/components/chat/ApprovalCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheckIcon, RefreshCwIcon, ClockIcon, HistoryIcon } from "lucide-react";

interface ApprovalItem {
  id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  data: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

type Tab = "pending" | "history";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setApprovals(data.approvals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleResolve = async (id: string, decision: "approved" | "rejected") => {
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    fetchApprovals();
  };

  const pendingItems = approvals.filter((a) => a.status === "pending");
  const historyItems = approvals.filter((a) => a.status !== "pending");
  const displayItems = tab === "pending" ? pendingItems : historyItems;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold">Approval Queue</h1>
          {pendingItems.length > 0 && (
            <Badge className="bg-approval-amber text-black">
              {pendingItems.length} pending
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={fetchApprovals}>
          <RefreshCwIcon className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("pending")}
        >
          <ClockIcon className="size-3.5" />
          Pending
          {pendingItems.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {pendingItems.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={tab === "history" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("history")}
        >
          <HistoryIcon className="size-3.5" />
          History
          {historyItems.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {historyItems.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl shimmer" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldCheckIcon className="size-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">
            {tab === "pending" ? "No pending approvals" : "No history yet"}
          </p>
          <p className="text-sm mt-1">
            {tab === "pending"
              ? "Actions that need your approval will appear here"
              : "Resolved approvals will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayItems.map((item) => (
            <ApprovalCard
              key={item.id}
              id={item.id}
              type={item.type}
              status={item.status}
              data={item.data}
              createdAt={item.createdAt}
              onApprove={
                item.status === "pending"
                  ? (id) => handleResolve(id, "approved")
                  : undefined
              }
              onReject={
                item.status === "pending"
                  ? (id) => handleResolve(id, "rejected")
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
