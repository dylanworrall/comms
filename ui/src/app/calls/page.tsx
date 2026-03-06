"use client";

import { useState, useEffect, useCallback } from "react";
import { CallLogEntry } from "@/components/chat/CallLogEntry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

interface CallRecord {
  id: string;
  contactName: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail";
  duration: number;
  timestamp: string;
  transcript?: string;
  notes?: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showNewCall, setShowNewCall] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newContact, setNewContact] = useState("");

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/calls");
    const data = await res.json();
    setCalls(data.calls ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleNewCall = async () => {
    if (!newPhone.trim()) return;
    await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: newPhone,
        contactName: newContact || "Unknown",
      }),
    });
    setNewPhone("");
    setNewContact("");
    setShowNewCall(false);
    fetchCalls();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PhoneIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold">Calls</h1>
          <Badge variant="secondary" className="text-xs">
            {calls.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={fetchCalls}>
            <RefreshCwIcon className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setShowNewCall(true)}>
            <PlusIcon className="size-3.5" />
            New Call
          </Button>
        </div>
      </div>

      {/* Call List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg shimmer" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PhoneIcon className="size-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No calls yet</p>
          <p className="text-sm mt-1">Call records will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <CallLogEntry
              key={call.id}
              {...call}
              onClick={(id) =>
                setSelectedCall(calls.find((c) => c.id === id) ?? null)
              }
            />
          ))}
        </div>
      )}

      {/* Call Detail Dialog */}
      <Dialog
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
      >
        <DialogContent className="sm:max-w-[500px] bg-surface-1 border-border max-h-[80vh] overflow-y-auto">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {selectedCall.contactName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="text-foreground">{selectedCall.phoneNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Direction: </span>
                    <span className="text-foreground capitalize">{selectedCall.direction}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="text-foreground capitalize">{selectedCall.status}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration: </span>
                    <span className="text-foreground">
                      {selectedCall.duration > 0
                        ? `${Math.floor(selectedCall.duration / 60)}m ${selectedCall.duration % 60}s`
                        : "--"}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedCall.timestamp).toLocaleString()}
                </div>
                {selectedCall.transcript && (
                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Transcript
                    </h3>
                    <div className="text-sm text-foreground whitespace-pre-wrap bg-surface-2 rounded-lg p-3 max-h-60 overflow-y-auto">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}
                {selectedCall.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Notes
                    </h3>
                    <div className="text-sm text-foreground">{selectedCall.notes}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Call Dialog */}
      <Dialog open={showNewCall} onOpenChange={setShowNewCall}>
        <DialogContent className="sm:max-w-[400px] bg-surface-1 border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number *"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="text"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="Contact name (optional)"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <p className="text-xs text-approval-amber">
              This will create an approval request for the outbound call.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewCall(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNewCall}
                disabled={!newPhone.trim()}
              >
                <PhoneIcon className="size-3.5" />
                Request Call
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
