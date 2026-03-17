"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SettingsIcon,
  SaveIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  MailIcon,
  PhoneIcon,
  BellIcon,
  CreditCardIcon,
  CoinsIcon,
  ExternalLinkIcon,
  LoaderIcon,
  TerminalIcon,
  AlertTriangleIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, authClient } from "@/lib/auth-client";

type AgentMode = "auto" | "draft" | "manual";

interface Settings {
  agentModes: Record<string, AgentMode>;
  fromEmail: string;
  anthropicModel: string;
  temperature: number;
  voiceProvider?: string;
  voiceApiKey?: string;
  notificationsEnabled: boolean;
}

interface AuthStatus {
  connected: boolean;
  method: string | null;
  masked: string | null;
  resend: { connected: boolean; masked: string | null; fromEmail: string | null };
}

type Tab = "general" | "billing" | "email" | "voice" | "notifications" | "ai-automations";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  list_contacts: "List all contacts",
  get_contact: "Get contact details",
  create_contact: "Create new contacts",
  update_contact: "Update contacts",
  search_contacts: "Search contacts",
  list_emails: "List emails",
  read_email: "Read email content",
  draft_email: "Draft emails",
  send_email: "Send emails",
  reply_to_email: "Reply to emails",
  list_calls: "List call records",
  get_call_transcript: "Get call transcripts",
  initiate_call: "Initiate phone calls",
  list_events: "List calendar events",
  create_event: "Create calendar events",
  check_availability: "Check availability",
  list_pending_approvals: "View approval queue",
  approve_action: "Approve actions",
  deny_action: "Deny actions",
  list_spaces: "List spaces",
  get_space: "Get space details",
  create_space: "Create spaces",
  get_settings: "View settings",
};

const MODE_COLORS: Record<AgentMode, string> = {
  auto: "bg-green-500/20 text-green-400 border-green-500/30",
  draft: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  manual: "bg-red-500/20 text-red-400 border-red-500/30",
};

/* ─── Resend Email Section ─── */
function ResendSection({ authStatus, onUpdate, fromEmail, onFromEmailChange }: {
  authStatus: AuthStatus | null;
  onUpdate: () => void;
  fromEmail: string;
  onFromEmailChange: (v: string) => void;
}) {
  const [resendKey, setResendKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSaveResend = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "resend", resendKey, fromEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setResendKey("");
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Resend (Outgoing Email)
      </h2>
      <div className="space-y-3">
        {/* Connection status */}
        {authStatus?.resend.connected ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm">
            <CheckCircleIcon className="size-4 text-green-500 shrink-0" />
            <span className="text-green-400">
              Connected <span className="text-muted-foreground">({authStatus.resend.masked})</span>
              {authStatus.resend.fromEmail && (
                <span className="text-muted-foreground"> — From: {authStatus.resend.fromEmail}</span>
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
            <XCircleIcon className="size-4 text-red-500 shrink-0" />
            <span className="text-red-400">Not connected — emails won&apos;t send</span>
          </div>
        )}

        {/* Key input */}
        <div className="space-y-3 p-4 rounded-xl bg-surface-1 border border-border">
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            Get Resend API Key <ExternalLinkIcon className="size-3.5" />
          </a>
          <input
            type="password"
            placeholder="re_..."
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From Email</label>
            <input
              type="email"
              placeholder="you@yourdomain.com"
              value={fromEmail}
              onChange={(e) => onFromEmailChange(e.target.value)}
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must match a verified domain in Resend. Free tier: use onboarding@resend.dev
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSaveResend}
            disabled={!resendKey.startsWith("re_") || saving}
          >
            {saving ? <LoaderIcon className="size-4 animate-spin" /> : "Verify & Save"}
          </Button>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── GogCLI Section ─── */
function GmailSection() {
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    accounts: string[];
    defaultAccount: string | null;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    fetch("/api/gmail/status").then((r) => r.json()).then(setGmailStatus).catch(() =>
      setGmailStatus({ connected: false, accounts: [], defaultAccount: null })
    );
  }, []);

  useEffect(() => {
    loadStatus();
    // Check URL params for gmail connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setSyncResult(`Connected ${params.get("account") || "Gmail account"}`);
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("gmail") === "error") {
      setSyncResult(`Connection failed: ${params.get("reason") || "unknown"}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [loadStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data.message || data.error || `Synced ${data.count} emails`);
    } catch {
      setSyncResult("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (email: string) => {
    setDisconnecting(email);
    try {
      await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      loadStatus();
    } catch {
      setSyncResult("Disconnect failed");
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Gmail (Personal Email)
      </h2>
      <div className="space-y-3">
        {gmailStatus === null ? (
          <div className="flex items-center justify-center py-4">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : gmailStatus.accounts.length === 0 ? (
          <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MailIcon className="size-4 text-muted-foreground" />
              No Gmail accounts connected
            </div>
            <p className="text-xs text-muted-foreground">
              Connect your Gmail to search, read, sync, and send emails directly from the chat.
            </p>
            <Button size="sm" asChild>
              <a href="/api/gmail/auth">Connect Gmail Account</a>
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">Connected Accounts</div>
              {gmailStatus.accounts.map((acct) => (
                <div key={acct} className="flex items-center gap-2 text-sm">
                  <CheckCircleIcon className="size-3.5 text-green-500 shrink-0" />
                  <span className="flex-1">{acct}</span>
                  {acct === gmailStatus.defaultAccount && (
                    <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">default</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleDisconnect(acct)}
                    disabled={disconnecting === acct}
                  >
                    {disconnecting === acct ? <LoaderIcon className="size-3 animate-spin" /> : "Remove"}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <LoaderIcon className="size-3.5 animate-spin" /> : "Sync Gmail"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/api/gmail/auth">Add Another Account</a>
              </Button>
              {syncResult && (
                <span className="text-xs text-muted-foreground">{syncResult}</span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ─── Local-mode Auth Section (API key / setup token) ─── */
function AuthSection({ authStatus, onUpdate }: { authStatus: AuthStatus | null; onUpdate: () => void }) {
  const [method, setMethod] = useState<"api-key" | "setup-token">("api-key");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const body =
        method === "api-key"
          ? { method: "api-key", apiKey }
          : { method: "setup-token", token };
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed");
        return;
      }
      setApiKey("");
      setToken("");
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Claude Authentication
      </h2>
      <div className="space-y-4">
        {/* Connection status */}
        {authStatus?.connected ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm">
            <CheckCircleIcon className="size-4 text-green-500 shrink-0" />
            <span className="text-green-400">
              Connected via {authStatus.method === "api-key" ? "API Key" : "Setup Token"}{" "}
              <span className="text-muted-foreground">({authStatus.masked})</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm">
            <XCircleIcon className="size-4 text-red-500 shrink-0" />
            <span className="text-red-400">Not connected</span>
          </div>
        )}

        {/* Method tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setMethod("api-key"); setError(""); }}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              method === "api-key"
                ? "border-accent bg-accent/5 text-foreground"
                : "border-border bg-surface-1 text-muted-foreground hover:border-border/80"
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <KeyIcon className="size-3.5" />
              API Key
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setMethod("setup-token"); setError(""); }}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              method === "setup-token"
                ? "border-accent bg-accent/5 text-foreground"
                : "border-border bg-surface-1 text-muted-foreground hover:border-border/80"
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <TerminalIcon className="size-3.5" />
              Setup Token
            </div>
          </button>
        </div>

        {/* API Key form */}
        {method === "api-key" && (
          <div className="space-y-3">
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              Get API Key <ExternalLinkIcon className="size-3.5" />
            </a>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apiKey && handleSubmit()}
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!apiKey.startsWith("sk-ant-") || loading}
            >
              {loading ? <LoaderIcon className="size-4 animate-spin" /> : "Verify & Save"}
            </Button>
          </div>
        )}

        {/* Setup Token form */}
        {method === "setup-token" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400 flex items-start gap-2">
              <AlertTriangleIcon className="size-3.5 shrink-0 mt-0.5" />
              <span>Uses your Claude Pro/Max subscription. May be restricted by Anthropic TOS.</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Run <code className="bg-surface-2 px-1.5 py-0.5 rounded text-foreground">claude setup-token</code> in your terminal, then paste below:
            </p>
            <input
              type="password"
              placeholder="Paste token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && token && handleSubmit()}
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!token || loading}
            >
              {loading ? <LoaderIcon className="size-4 animate-spin" /> : "Verify & Save"}
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Voice Agent Configuration (Multi-Agent) ─── */
type VoiceEngine = "openai" | "gemini";

interface AgentData {
  id: string;
  agentName: string;
  companyName: string;
  voice: string;
  voiceEngine: VoiceEngine;
  activeTemplate: string;
  customPrompt: string;
  callbackNumber: string;
  transferNumber: string;
  phoneNumber: string;
}

function VoiceAgentSection() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [templates, setTemplates] = useState<{ key: string; label: string; description: string }[]>([]);
  const [geminiVoices, setGeminiVoices] = useState<{ id: string; label: string; description: string }[]>([]);
  const [openaiVoices, setOpenaiVoices] = useState<{ id: string; label: string; description: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [twilioNumbers, setTwilioNumbers] = useState<string[]>([]);

  const loadData = useCallback(() => {
    fetch("/api/voice-agent")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents || []);
        setTemplates(data.templates || []);
        setGeminiVoices(data.geminiVoices || []);
        setOpenaiVoices(data.openaiVoices || []);
        if (!selectedId && data.agents?.length > 0) {
          setSelectedId(data.agents[0].id);
        }
      })
      .catch(() => {});
    // Load available Twilio numbers
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.twilio?.fromNumber) {
          setTwilioNumbers([data.twilio.fromNumber]);
        }
      })
      .catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agent = agents.find((a) => a.id === selectedId);

  const updateField = (field: string, value: string) => {
    if (!agent) return;
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, [field]: value } : a)));
  };

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/voice-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, ...agent }),
      });
      if (!res.ok) { setError("Failed to save"); return; }
      setSuccess("Agent saved.");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleCreate = async (templateKey?: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/voice-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", templateKey }),
      });
      const data = await res.json();
      if (data.agent) {
        setAgents((prev) => [...prev, data.agent]);
        setSelectedId(data.agent.id);
        setSuccess("New agent created.");
      }
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!agent || agents.length <= 1) return;
    setSaving(true);
    try {
      await fetch("/api/voice-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", agentId: agent.id }),
      });
      const remaining = agents.filter((a) => a.id !== agent.id);
      setAgents(remaining);
      setSelectedId(remaining[0]?.id || "");
      setSuccess("Agent deleted.");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleApplyTemplate = async (key: string) => {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await fetch("/api/voice-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "applyTemplate", agentId: agent.id, templateKey: key }),
      });
      const data = await res.json();
      if (data.agent) {
        setAgents((prev) => prev.map((a) => (a.id === data.agent.id ? data.agent : a)));
        setSuccess(`Template applied.`);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  if (agents.length === 0) return null;

  return (
    <div className="space-y-8 mb-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Voice Agents
          </h2>
          <Button size="sm" variant="outline" onClick={() => handleCreate()} disabled={saving}>
            <PlusIcon className="size-3.5" />
            <span className="ml-1">New Agent</span>
          </Button>
        </div>

        <div className="space-y-4">
          {/* Agent Selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setSuccess(""); setError(""); }}
              className="flex-1 bg-surface-1 rounded-lg px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.agentName} — {templates.find((t) => t.key === a.activeTemplate)?.label || a.activeTemplate}
                  {a.phoneNumber ? ` (${a.phoneNumber})` : " (no number)"}
                </option>
              ))}
            </select>
            {agents.length > 1 && (
              <Button size="sm" variant="outline" onClick={handleDelete} disabled={saving}>
                <TrashIcon className="size-3.5 text-red-400" />
              </Button>
            )}
          </div>

          {agent && (
            <>
              {/* Template Presets */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Template</h3>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => handleApplyTemplate(t.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                        agent.activeTemplate === t.key
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:border-foreground/15"
                      )}
                      title={t.description}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Number Assignment */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Assigned Phone Number</h3>
                <p className="text-xs text-muted-foreground">
                  This agent will handle all calls on this number. Get more numbers below.
                </p>
                <select
                  value={agent.phoneNumber}
                  onChange={(e) => updateField("phoneNumber", e.target.value)}
                  className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">No number assigned</option>
                  {twilioNumbers.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Agent Identity */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Agent Identity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Agent Name</label>
                    <input type="text" value={agent.agentName} onChange={(e) => updateField("agentName", e.target.value)} placeholder="Jordan" className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name</label>
                    <input type="text" value={agent.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="My Company" className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Callback Number</label>
                    <input type="text" value={agent.callbackNumber} onChange={(e) => updateField("callbackNumber", e.target.value)} placeholder="+1..." className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Transfer Number</label>
                    <input type="text" value={agent.transferNumber} onChange={(e) => updateField("transferNumber", e.target.value)} placeholder="+1..." className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50" />
                  </div>
                </div>
              </div>

              {/* Voice Engine */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Voice Engine</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateField("voiceEngine", "openai");
                      // Reset voice to a valid OpenAI voice if current isn't one
                      const isOpenaiVoice = openaiVoices.some((v) => v.id === agent.voice);
                      if (!isOpenaiVoice) updateField("voice", "coral");
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                      agent.voiceEngine === "openai"
                        ? "bg-accent/15 border-accent/30 text-accent"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:border-foreground/15"
                    )}
                  >
                    <div className="flex items-center gap-1.5 justify-center">
                      <ZapIcon className="size-3.5" />
                      OpenAI Realtime
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-60">~230ms latency</div>
                  </button>
                  <button
                    onClick={() => {
                      updateField("voiceEngine", "gemini");
                      // Reset voice to a valid Gemini voice if current isn't one
                      const isGeminiVoice = geminiVoices.some((v) => v.id === agent.voice);
                      if (!isGeminiVoice) updateField("voice", "Achird");
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                      (agent.voiceEngine || "gemini") === "gemini"
                        ? "bg-accent/15 border-accent/30 text-accent"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:border-foreground/15"
                    )}
                  >
                    <div className="flex items-center justify-center">Gemini Live</div>
                    <div className="text-[10px] mt-0.5 opacity-60">20 voices, native audio</div>
                  </button>
                </div>
              </div>

              {/* Voice */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Voice</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(agent.voiceEngine === "openai" ? openaiVoices : geminiVoices).map((v) => (
                    <button key={v.id} onClick={() => updateField("voice", v.id)} className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer", agent.voice === v.id ? "bg-accent/15 border-accent/30 text-accent" : "bg-surface-2 border-border text-muted-foreground hover:text-foreground")} title={v.description}>
                      {v.label} <span className="text-muted-foreground/60">({v.description})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
                <h3 className="text-sm font-medium">Agent Script / System Prompt</h3>
                <p className="text-xs text-muted-foreground">
                  Variables: [AgentName], [Company], [Name], [CallbackNumber]
                </p>
                <textarea value={agent.customPrompt} onChange={(e) => updateField("customPrompt", e.target.value)} rows={12} className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono" />
              </div>

              {/* Save */}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <LoaderIcon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                  <span className="ml-1.5">Save Agent</span>
                </Button>
              </div>
            </>
          )}

          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>}
          {success && <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm text-green-400">{success}</div>}
        </div>
      </section>
    </div>
  );
}

/* ─── Voice & Phone Number Section ─── */
interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

function TwilioVoiceSection() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fromNumber, setFromNumber] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  // Phone number search state
  const [searchCountry, setSearchCountry] = useState("US");
  const [searchType, setSearchType] = useState("local");
  const [searchAreaCode, setSearchAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(!!data.twilio?.connected);
        setFromNumber(data.twilio?.fromNumber ?? null);
      })
      .catch(() => {
        setConfigured(false);
        setFromNumber(null);
      });
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSearchNumbers = async () => {
    setError("");
    setSearching(true);
    setAvailableNumbers([]);
    try {
      const params = new URLSearchParams({
        country: searchCountry,
        type: searchType,
      });
      if (searchAreaCode.trim()) params.set("areaCode", searchAreaCode.trim());

      const res = await fetch(`/api/twilio/phone-numbers?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No numbers available. Try different options.");
        return;
      }
      setAvailableNumbers(data.numbers || []);
      if (!data.numbers?.length) {
        setError("No numbers found. Try a different area code or type.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    setError("");
    setSuccess("");
    setPurchasing(phoneNumber);
    try {
      const res = await fetch("/api/twilio/phone-numbers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to provision number");
        return;
      }
      setSuccess(`${data.phoneNumber} is now your phone number.`);
      setAvailableNumbers([]);
      loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing(null);
    }
  };

  if (!configured) {
    return (
      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Phone Number
          </h2>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-muted-foreground">
            <PhoneIcon className="size-4 shrink-0" />
            Voice calling is not available yet. Contact support to enable it.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Phone Number
        </h2>
        <div className="space-y-4">
          {/* Current number */}
          {fromNumber ? (
            <div className="p-4 rounded-xl bg-surface-1 border border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-xl bg-green-500/10 border border-green-500/20">
                  <PhoneIcon className="size-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Your number</p>
                  <p className="text-lg font-mono font-semibold text-foreground">{fromNumber}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                This number is used for outbound calls and as your caller ID.
                You can get a different number below.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
              <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />
              <span className="text-amber-400">No phone number yet — get one below to start making calls</span>
            </div>
          )}

          {/* Get a number */}
          <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-3">
            <h3 className="text-sm font-medium">
              {fromNumber ? "Get a different number" : "Get a phone number"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose your country and preferred number type, then pick one you like.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                className="bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
              </select>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="local">Local</option>
                <option value="tollFree">Toll-Free</option>
              </select>
              <input
                type="text"
                placeholder="Area code"
                value={searchAreaCode}
                onChange={(e) => setSearchAreaCode(e.target.value)}
                className="w-28 bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <Button size="sm" onClick={handleSearchNumbers} disabled={searching}>
                {searching ? <LoaderIcon className="size-4 animate-spin" /> : "Find Numbers"}
              </Button>
            </div>

            {/* Results */}
            {availableNumbers.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {availableNumbers.map((n) => (
                  <div
                    key={n.phoneNumber}
                    className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-3 py-2.5"
                  >
                    <div>
                      <span className="text-sm font-mono font-medium text-foreground">{n.phoneNumber}</span>
                      {(n.locality || n.region) && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {[n.locality, n.region].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <div className="flex gap-1.5 mt-1">
                        {n.capabilities.voice && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Voice</span>}
                        {n.capabilities.sms && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">SMS</span>}
                        {n.capabilities.mms && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">MMS</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePurchaseNumber(n.phoneNumber)}
                      disabled={purchasing !== null}
                    >
                      {purchasing === n.phoneNumber ? (
                        <LoaderIcon className="size-4 animate-spin" />
                      ) : (
                        "Select"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm text-green-400">
              {success}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("general");
  const [creditInfo, setCreditInfo] = useState<{
    plan: string; available: number; consumed: number; credited: number; mode: string;
  } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: session } = useSession();
  const userEmail = session?.user?.email;

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/auth").then((r) => r.json()).then(setAuthStatus);
  }, []);

  useEffect(() => {
    if (userEmail) {
      fetch(`/api/credits?email=${encodeURIComponent(userEmail)}`)
        .then((r) => r.json())
        .then(setCreditInfo);
    }
  }, [userEmail]);

  const handleBuyCredits = async (productId: string) => {
    setCheckoutLoading(true);
    try {
      await authClient.checkoutEmbed({
        products: [productId],
        successUrl: window.location.origin + "/settings?tab=billing&purchased=1",
      });
    } catch {
      // Embed may handle its own UI
    } finally {
      setCheckoutLoading(false);
    }
  };

  const toggleMode = useCallback((tool: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const current = prev.agentModes[tool] ?? "auto";
      const next: AgentMode =
        current === "auto" ? "draft" : current === "draft" ? "manual" : "auto";
      return {
        ...prev,
        agentModes: { ...prev.agentModes, [tool]: next },
      };
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  if (!settings) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const isCloudMode = !!process.env.NEXT_PUBLIC_CONVEX_URL;

  const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
    { value: "general", label: "General", icon: SettingsIcon },
    ...(isCloudMode ? [{ value: "billing" as Tab, label: "Billing", icon: CreditCardIcon }] : []),
    { value: "email", label: "Email", icon: MailIcon },
    { value: "voice", label: "Voice", icon: PhoneIcon },
    { value: "notifications", label: "Notifications", icon: BellIcon },
    { value: "ai-automations" as Tab, label: "AI Automations", icon: SparklesIcon },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          <SaveIcon className="size-3.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
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
            <t.icon className="size-3.5" />
            {t.label}
          </Button>
        ))}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="space-y-8">
          {/* Auth — local mode: inline API key form; cloud mode: status only */}
          {!isCloudMode ? (
            <AuthSection authStatus={authStatus} onUpdate={() => {
              fetch("/api/auth").then((r) => r.json()).then(setAuthStatus);
            }} />
          ) : (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Authentication
              </h2>
              <div className="p-4 rounded-xl bg-surface-1 border border-border">
                <div className="flex items-center gap-3">
                  <KeyIcon className="size-5 text-accent" />
                  <div>
                    <div className="font-medium text-sm">Signed in via cloud</div>
                    <div className="text-xs text-muted-foreground">
                      Server-managed API key
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Model + Temperature */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Model Configuration
            </h2>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-1 border border-border">
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={settings.anthropicModel}
                  onChange={(e) =>
                    setSettings({ ...settings, anthropicModel: e.target.value })
                  }
                  className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="p-3 rounded-xl bg-surface-1 border border-border">
                <label className="block text-sm font-medium mb-1">
                  Temperature: {settings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      temperature: Number(e.target.value),
                    })
                  }
                  className="w-full accent-accent"
                />
              </div>
            </div>
          </section>

          {/* Agent Modes */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Agent Modes
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Control how each action runs. <strong>Auto</strong> = runs immediately.{" "}
              <strong>Draft</strong> = queued for approval. <strong>Manual</strong> = requires explicit command.
            </p>
            <div className="space-y-2">
              {Object.entries(settings.agentModes).map(([tool, mode]) => (
                <div
                  key={tool}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-1 border border-border"
                >
                  <div>
                    <div className="font-medium text-sm">{tool}</div>
                    <div className="text-xs text-muted-foreground">
                      {TOOL_DESCRIPTIONS[tool] ?? ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMode(tool)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors",
                      MODE_COLORS[mode]
                    )}
                  >
                    {mode}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Billing Tab */}
      {tab === "billing" && (
        <div className="space-y-8">
          {/* Current Plan & Usage */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Current Plan
            </h2>
            <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-4">
              {!creditInfo ? (
                <div className="flex items-center justify-center py-4">
                  <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : creditInfo.mode === "local" ? (
                <div className="flex items-center gap-3">
                  <CoinsIcon className="size-5 text-green-400" />
                  <div>
                    <div className="font-medium text-sm">Local Mode</div>
                    <div className="text-xs text-muted-foreground">Unlimited credits — using your own API key</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CoinsIcon className="size-5 text-accent" />
                      <div>
                        <div className="font-medium text-sm capitalize">{creditInfo.plan} Plan</div>
                        <div className="text-xs text-muted-foreground">
                          {creditInfo.credited} credits granted this period
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent">{creditInfo.available}</div>
                      <div className="text-xs text-muted-foreground">available</div>
                    </div>
                  </div>
                  {/* Usage bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{creditInfo.consumed} consumed</span>
                      <span>{creditInfo.credited} credited</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${creditInfo.credited > 0 ? Math.min(100, (creditInfo.consumed / creditInfo.credited) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Subscription Plans */}
          {creditInfo?.mode === "cloud" && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Plans
              </h2>
              <div className="grid gap-3">
                {[
                  { plan: "free", label: "Free", price: "$0/mo", credits: "50 credits/month", productId: "" },
                  { plan: "pro", label: "Pro", price: "$19/mo", credits: "500 credits/month", productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO || "" },
                  { plan: "business", label: "Business", price: "$49/mo", credits: "2,000 credits/month", productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_BUSINESS || "" },
                ].map(({ plan, label, price, credits, productId }) => {
                  const isCurrent = creditInfo.plan === plan;
                  return (
                    <div
                      key={plan}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border",
                        isCurrent ? "bg-accent/5 border-accent/30" : "bg-surface-1 border-border"
                      )}
                    >
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {label}
                          {isCurrent && (
                            <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Current</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{price} — {credits}</div>
                      </div>
                      {!isCurrent && plan !== "free" && (
                        <Button
                          size="sm"
                          onClick={() => handleBuyCredits(productId)}
                          disabled={checkoutLoading || !productId}
                        >
                          {checkoutLoading ? (
                            <LoaderIcon className="size-3.5 animate-spin" />
                          ) : (
                            <>Upgrade <ExternalLinkIcon className="size-3" /></>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Overage Credits */}
          {creditInfo?.mode === "cloud" && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Overage Credits
              </h2>
              <div className="p-4 rounded-xl bg-surface-1 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">100 Credits</div>
                    <div className="text-xs text-muted-foreground">$10 one-time — never expire, used after monthly allowance</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleBuyCredits(process.env.NEXT_PUBLIC_POLAR_PRODUCT_OVERAGE || "")}
                    disabled={checkoutLoading || !process.env.NEXT_PUBLIC_POLAR_PRODUCT_OVERAGE}
                  >
                    {checkoutLoading ? (
                      <LoaderIcon className="size-3.5 animate-spin" />
                    ) : (
                      <>Buy <ExternalLinkIcon className="size-3" /></>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Payments handled securely by Polar. Credits are added instantly.
              </p>
            </section>
          )}

          {/* Polar Customer Portal (cloud only) */}
          {creditInfo?.mode === "cloud" && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Manage Subscription
              </h2>
              <div className="p-4 rounded-xl bg-surface-1 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Polar Customer Portal</div>
                    <div className="text-xs text-muted-foreground">
                      View orders, manage subscriptions, and download invoices
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://polar.sh/purchases", "_blank")}
                  >
                    Open Portal <ExternalLinkIcon className="size-3" />
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <div className="space-y-8">
          {/* Resend (Sending) */}
          <ResendSection authStatus={authStatus} onUpdate={() => {
            fetch("/api/auth").then((r) => r.json()).then(setAuthStatus);
          }} fromEmail={settings.fromEmail} onFromEmailChange={(v) => setSettings({ ...settings, fromEmail: v })} />

          {/* Gmail (Personal Email) */}
          <GmailSection />
        </div>
      )}

      {/* Voice Tab */}
      {tab === "voice" && (
        <>
          <VoiceAgentSection />
          <TwilioVoiceSection />
        </>
      )}

      {/* Notifications Tab */}
      {tab === "notifications" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Notification Preferences
            </h2>
            <div className="p-4 rounded-xl bg-surface-1 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Enable Notifications</div>
                  <div className="text-xs text-muted-foreground">
                    Get notified about new approvals, emails, and calls
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      notificationsEnabled: !settings.notificationsEnabled,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                    settings.notificationsEnabled ? "bg-accent" : "bg-surface-3"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-[left]",
                      settings.notificationsEnabled ? "left-6" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* AI Automations Tab */}
      {tab === "ai-automations" && (
        <AIAutomationsSection />
      )}
    </div>
  );
}

/* ─── AI Automations Settings Section ─── */

interface AITag {
  id: string;
  name: string;
  points: number;
  color: string;
}

interface AIProject {
  id: string;
  name: string;
  emoji: string;
  domain: string;
}

interface AISettingsData {
  enabled: boolean;
  tags: AITag[];
  projects: AIProject[];
  autoRespond: boolean;
  systemPrompt: string;
  processedCount: number;
}

const TAG_COLORS = [
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "gray", label: "Gray", class: "bg-gray-500" },
];

function AIAutomationsSection() {
  const [aiSettings, setAISettings] = useState<AISettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-settings")
      .then((r) => r.json())
      .then((data) => { setAISettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const saveSettings = async (updates: Partial<AISettingsData>) => {
    if (!aiSettings) return;
    const updated = { ...aiSettings, ...updates };
    setAISettings(updated);
    setSaving(true);
    try {
      const res = await fetch("/api/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setAISettings(data);
    } catch { /* silent */ }
    setSaving(false);
  };

  const runProcessing = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch("/api/ai/process-emails", { method: "POST" });
      const data = await res.json();
      setProcessResult(data.message || data.error || "Done");
      // Refresh settings to get updated processedCount
      const settingsRes = await fetch("/api/ai-settings");
      const settingsData = await settingsRes.json();
      setAISettings(settingsData);
    } catch {
      setProcessResult("Failed to process emails");
    }
    setProcessing(false);
  };

  const addTag = () => {
    if (!aiSettings) return;
    const newTag: AITag = {
      id: `tag-${Date.now()}`,
      name: "New Tag",
      points: 0,
      color: "blue",
    };
    saveSettings({ tags: [...aiSettings.tags, newTag] });
  };

  const updateTag = (id: string, updates: Partial<AITag>) => {
    if (!aiSettings) return;
    const tags = aiSettings.tags.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    saveSettings({ tags });
  };

  const removeTag = (id: string) => {
    if (!aiSettings) return;
    saveSettings({ tags: aiSettings.tags.filter((t) => t.id !== id) });
  };

  const addProject = () => {
    if (!aiSettings) return;
    const newProj: AIProject = {
      id: `proj-${Date.now()}`,
      name: "New Project",
      emoji: "📦",
      domain: "",
    };
    saveSettings({ projects: [...(aiSettings.projects || []), newProj] });
  };

  const updateProject = (id: string, updates: Partial<AIProject>) => {
    if (!aiSettings) return;
    const projs = (aiSettings.projects || []).map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    saveSettings({ projects: projs });
  };

  const removeProject = (id: string) => {
    if (!aiSettings) return;
    saveSettings({ projects: (aiSettings.projects || []).filter((p) => p.id !== id) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!aiSettings) return null;

  return (
    <div className="space-y-8">
      {/* Master Toggle */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          AI Email Processing
        </h2>
        <div className="p-4 rounded-xl bg-surface-1 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <SparklesIcon className="size-4 text-accent" />
                Enable AI Processing
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Auto-tag, classify, summarize, and score priority on incoming emails
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveSettings({ enabled: !aiSettings.enabled })}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                aiSettings.enabled ? "bg-accent" : "bg-surface-3"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-[left]",
                  aiSettings.enabled ? "left-6" : "left-0.5"
                )}
              />
            </button>
          </div>

          {/* Auto-Respond Toggle */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <ZapIcon className="size-4 text-amber-400" />
                Auto-Draft Replies
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                AI generates draft replies for emails that warrant a response
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveSettings({ autoRespond: !aiSettings.autoRespond })}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                aiSettings.autoRespond ? "bg-amber-500" : "bg-surface-3"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-[left]",
                  aiSettings.autoRespond ? "left-6" : "left-0.5"
                )}
              />
            </button>
          </div>

          {/* Process Now */}
          <div className="flex items-center gap-3 pt-3 border-t border-border/50">
            <Button
              size="sm"
              onClick={runProcessing}
              disabled={!aiSettings.enabled || processing}
              className="gap-2"
            >
              {processing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              Process Emails Now
            </Button>
            <span className="text-xs text-muted-foreground">
              {aiSettings.processedCount} emails processed
            </span>
            {processResult && (
              <span className="text-xs text-accent">{processResult}</span>
            )}
          </div>
        </div>
      </section>

      {/* Tags Configuration */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Priority Tags
        </h2>
        <div className="text-xs text-muted-foreground mb-3">
          AI assigns tags to emails. Each tag has a point value — emails are scored by the sum of their tag points.
        </div>
        <div className="space-y-2">
          {aiSettings.tags.map((tag) => {
            const colorDef = TAG_COLORS.find((c) => c.value === tag.color) || TAG_COLORS[0];
            return (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-border"
              >
                {/* Color dot */}
                <select
                  value={tag.color}
                  onChange={(e) => updateTag(tag.id, { color: e.target.value })}
                  className="w-8 h-8 rounded-full appearance-none cursor-pointer border-2 border-border"
                  style={{
                    backgroundColor: `var(--color-${tag.color || "blue"}, #3b82f6)`,
                  }}
                  title="Tag color"
                >
                  {TAG_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                {/* Name */}
                <input
                  type="text"
                  value={tag.name}
                  onChange={(e) => updateTag(tag.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-sm text-foreground border-b border-transparent hover:border-border focus:border-accent focus:outline-none py-1 px-1"
                />

                {/* Points */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">pts:</span>
                  <input
                    type="number"
                    value={tag.points}
                    onChange={(e) =>
                      updateTag(tag.id, { points: parseInt(e.target.value) || 0 })
                    }
                    className="w-14 bg-surface-2 rounded px-2 py-1 text-sm text-center border border-border focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeTag(tag.id)}
                  className="text-muted-foreground/50 hover:text-red-400 transition-colors p-1"
                  title="Remove tag"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            );
          })}

          <button
            onClick={addTag}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors w-full"
          >
            <PlusIcon className="size-4" />
            Add Tag
          </button>
        </div>
      </section>

      {/* Projects */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Projects
        </h2>
        <div className="text-xs text-muted-foreground mb-3">
          Your products/apps. Emails are matched to projects by domain (e.g. emails from or to &quot;myapp.com&quot; belong to that project).
        </div>
        <div className="space-y-2">
          {(aiSettings.projects || []).map((proj) => (
            <div
              key={proj.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-border"
            >
              {/* Emoji */}
              <input
                type="text"
                value={proj.emoji}
                onChange={(e) => updateProject(proj.id, { emoji: e.target.value.slice(0, 2) })}
                className="w-10 bg-surface-2 rounded-lg text-center text-lg border border-border focus:border-accent focus:outline-none py-1"
                title="Emoji"
              />

              {/* Name */}
              <input
                type="text"
                value={proj.name}
                onChange={(e) => updateProject(proj.id, { name: e.target.value })}
                placeholder="Project name"
                className="flex-1 bg-transparent text-sm text-foreground border-b border-transparent hover:border-border focus:border-accent focus:outline-none py-1 px-1"
              />

              {/* Domain */}
              <input
                type="text"
                value={proj.domain}
                onChange={(e) => updateProject(proj.id, { domain: e.target.value })}
                placeholder="domain.com"
                className="w-36 bg-surface-2 rounded px-2 py-1 text-xs text-muted-foreground border border-border focus:border-accent focus:outline-none font-mono"
              />

              {/* Delete */}
              <button
                onClick={() => removeProject(proj.id)}
                className="text-muted-foreground/50 hover:text-red-400 transition-colors p-1"
                title="Remove project"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={addProject}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors w-full"
          >
            <PlusIcon className="size-4" />
            Add Project
          </button>
        </div>
      </section>

      {/* System Prompt */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          AI Agent Prompt
        </h2>
        <div className="text-xs text-muted-foreground mb-3">
          Customize how the AI processes and responds to emails. This prompt guides tagging, classification, and auto-responses.
        </div>
        <textarea
          value={aiSettings.systemPrompt}
          onChange={(e) => setAISettings({ ...aiSettings, systemPrompt: e.target.value })}
          onBlur={() => saveSettings({ systemPrompt: aiSettings.systemPrompt })}
          rows={6}
          className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-accent/40 resize-y"
          placeholder="You are an email triage assistant..."
        />
      </section>

      {saving && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-2 border border-border rounded-lg px-4 py-2 text-xs text-muted-foreground shadow-elevation-2 flex items-center gap-2">
          <Loader2Icon className="size-3 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}
