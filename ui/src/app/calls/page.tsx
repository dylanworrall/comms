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
import {
  PhoneIcon,
  PlusIcon,
  RefreshCwIcon,
  PhoneOffIcon,
  MicIcon,
  MicOffIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useTwilioCall } from "@/lib/hooks/useTwilioCall";
import { cn } from "@/lib/utils";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showNewCall, setShowNewCall] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newContact, setNewContact] = useState("");

  const { callState, configured, dial, hangup, mute, unmute } = useTwilioCall();

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

  // Refresh call list when a call ends
  useEffect(() => {
    if (callState.status === "ended") {
      // Small delay to let the record save
      const t = setTimeout(fetchCalls, 1500);
      return () => clearTimeout(t);
    }
  }, [callState.status, fetchCalls]);

  const handleNewCall = () => {
    if (!newPhone.trim()) return;

    if (configured) {
      // Use Twilio WebRTC to place the call
      dial(newPhone.trim(), newContact || undefined);
      setShowNewCall(false);
      setNewPhone("");
      setNewContact("");
    } else {
      // Fall back to approval flow
      fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newPhone,
          contactName: newContact || "Unknown",
        }),
      }).then(() => {
        setNewPhone("");
        setNewContact("");
        setShowNewCall(false);
        fetchCalls();
      });
    }
  };

  const isCallActive =
    callState.status === "connecting" ||
    callState.status === "ringing" ||
    callState.status === "active";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Active Call Bar */}
      {isCallActive && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Pulse indicator */}
              <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="absolute w-3 h-3 rounded-full bg-green-500 animate-ping" />
              </div>

              <div>
                <div className="text-sm font-medium text-foreground">
                  {callState.status === "connecting" && "Connecting..."}
                  {callState.status === "ringing" && "Ringing..."}
                  {callState.status === "active" && (
                    <span className="flex items-center gap-2">
                      On Call
                      <span className="text-accent font-mono text-xs">
                        {formatDuration(callState.duration)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {newContact || newPhone || "Outbound call"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mute/Unmute */}
              {callState.status === "active" && (
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-9 w-9",
                    callState.isMuted && "bg-red-500/10 border-red-500/30 text-red-400"
                  )}
                  onClick={() => (callState.isMuted ? unmute() : mute())}
                >
                  {callState.isMuted ? (
                    <MicOffIcon className="size-4" />
                  ) : (
                    <MicIcon className="size-4" />
                  )}
                </Button>
              )}

              {/* Hang up */}
              <Button
                variant="outline"
                size="sm"
                className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                onClick={hangup}
              >
                <PhoneOffIcon className="size-3.5" />
                End
              </Button>
            </div>
          </div>

          {callState.error && (
            <div className="mt-2 text-xs text-red-400">{callState.error}</div>
          )}
        </div>
      )}

      {/* Ended call brief notification */}
      {callState.status === "ended" && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <PhoneIcon className="size-4" />
            Call ended ({formatDuration(callState.duration)})
          </div>
        </div>
      )}

      {/* Not configured warning */}
      {configured === false && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <div>
              <span className="font-medium">Twilio not configured.</span>{" "}
              <a href="/settings" className="underline hover:text-amber-300">
                Go to Settings &gt; Voice
              </a>{" "}
              to set your API key and SIP Connection ID.
              <span className="block text-xs text-amber-400/70 mt-1">
                New calls will use the approval flow instead of live calling.
              </span>
            </div>
          </div>
        </div>
      )}

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
          <Button
            size="sm"
            onClick={() => setShowNewCall(true)}
            disabled={isCallActive}
          >
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
              placeholder="Phone number (e.g. +15551234567) *"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              onKeyDown={(e) => e.key === "Enter" && newPhone.trim() && handleNewCall()}
            />
            <input
              type="text"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="Contact name (optional)"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              onKeyDown={(e) => e.key === "Enter" && newPhone.trim() && handleNewCall()}
            />
            {configured ? (
              <p className="text-xs text-green-400">
                Call will be placed via Twilio WebRTC.
              </p>
            ) : (
              <p className="text-xs text-approval-amber">
                Twilio not configured. This will create an approval request.
              </p>
            )}
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
                {configured ? "Call" : "Request Call"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
