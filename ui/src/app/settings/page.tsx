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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type Tab = "general" | "email" | "voice" | "notifications";

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("general");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/auth").then((r) => r.json()).then(setAuthStatus);
  }, []);

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

  const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
    { value: "general", label: "General", icon: SettingsIcon },
    { value: "email", label: "Email", icon: MailIcon },
    { value: "voice", label: "Voice", icon: PhoneIcon },
    { value: "notifications", label: "Notifications", icon: BellIcon },
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
          {/* Auth Status */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Authentication
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-1 border border-border">
                <div className="flex items-center gap-3">
                  <KeyIcon className="size-5 text-accent" />
                  <div>
                    <div className="font-medium text-sm">Anthropic API</div>
                    <div className="text-xs text-muted-foreground">
                      {authStatus?.connected
                        ? `Key: ${authStatus.masked}`
                        : "Not connected"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="outline" size="sm">
                      {authStatus?.connected ? "Re-auth" : "Connect"}
                    </Button>
                  </Link>
                  {authStatus?.connected ? (
                    <Badge className="gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30">
                      <CheckCircleIcon className="size-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30">
                      <XCircleIcon className="size-3" />
                      Not connected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </section>

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

      {/* Email Tab */}
      {tab === "email" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Email Configuration
            </h2>
            <div className="space-y-3">
              {/* Resend Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-1 border border-border">
                <div className="flex items-center gap-3">
                  <MailIcon className="size-5 text-approval-amber" />
                  <div>
                    <div className="font-medium text-sm">Resend (Email Provider)</div>
                    <div className="text-xs text-muted-foreground">
                      {authStatus?.resend.connected
                        ? `Key: ${authStatus.resend.masked}`
                        : "Not connected"}
                    </div>
                  </div>
                </div>
                {authStatus?.resend.connected ? (
                  <Badge className="gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30">
                    <CheckCircleIcon className="size-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge className="gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30">
                    <XCircleIcon className="size-3" />
                    Not connected
                  </Badge>
                )}
              </div>

              <div className="p-3 rounded-xl bg-surface-1 border border-border">
                <label className="block text-sm font-medium mb-1">From Email</label>
                <input
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, fromEmail: e.target.value })
                  }
                  className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is the sender address for outgoing emails.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Voice Tab */}
      {tab === "voice" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Voice Configuration
            </h2>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-1 border border-border">
                <label className="block text-sm font-medium mb-1">Voice Provider</label>
                <input
                  type="text"
                  value={settings.voiceProvider ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, voiceProvider: e.target.value || undefined })
                  }
                  placeholder="e.g., elevenlabs, livekit"
                  className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="p-3 rounded-xl bg-surface-1 border border-border">
                <label className="block text-sm font-medium mb-1">Voice API Key</label>
                <input
                  type="password"
                  value={settings.voiceApiKey ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, voiceApiKey: e.target.value || undefined })
                  }
                  placeholder="API key for voice provider"
                  className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Voice calling uses LiveKit Agents + Telnyx. Configure your provider credentials to enable outbound calls.
              </p>
            </div>
          </section>
        </div>
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
    </div>
  );
}
