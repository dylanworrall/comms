"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart, DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { InboxIcon, UsersIcon, MailIcon, ShieldCheckIcon, AlertTriangleIcon, SettingsIcon, TerminalIcon, ChevronDownIcon } from "lucide-react";
import { useSession } from "@/lib/auth-client";

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
];

const TAGLINES = [
  "Your AI-powered communication hub",
  "One interface for all your comms",
  "Contacts, email, calls — all in one place",
  "Draft, send, and manage with AI",
  "Communication on autopilot",
];

const SUGGESTIONS = [
  { label: "Check inbox", icon: InboxIcon, prompt: "Show my inbox" },
  { label: "List contacts", icon: UsersIcon, prompt: "List my contacts" },
  { label: "Draft email", icon: MailIcon, prompt: "Draft an email" },
  { label: "Show approvals", icon: ShieldCheckIcon, prompt: "Show pending approvals" },
];

const SLASH_COMMANDS: Record<string, string> = {
  "/inbox": "Show my inbox",
  "/contacts": "List my contacts",
  "/approvals": "Show pending approvals",
  "/calls": "Show recent calls",
  "/draft": "Draft an email",
  "/schedule": "Check my calendar",
};

export default function ChatPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const [model, setModel] = useState("gemini-2.5-flash");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { ...(userEmail ? { userEmail } : {}), model },
      }),
    [userEmail, model]
  );

  const isCloudMode = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  const sessionReady = !isCloudMode || !!userEmail;

  const { messages, sendMessage, status, stop } = useChat({ transport });
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    // In cloud mode, middleware handles auth — no need to check API key
    if (process.env.NEXT_PUBLIC_CONVEX_URL) {
      setAuthChecked(true);
      return;
    }
    // Local mode: check if API key is configured
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (!data.connected) {
          setNeedsApiKey(true);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((i) => (i + 1) % TAGLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = useCallback(
    (message: { text: string }) => {
      if (!sessionReady) return;
      let text = message.text.trim();
      if (!text) return;

      // Slash command expansion
      const cmd = text.toLowerCase();
      if (SLASH_COMMANDS[cmd]) {
        text = SLASH_COMMANDS[cmd];
      }

      sendMessage({ text });
    },
    [sendMessage, sessionReady]
  );

  const handleSuggestion = useCallback(
    (prompt: string) => {
      sendMessage({ text: prompt });
    },
    [sendMessage]
  );

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (needsApiKey) {
    return (
      <div className="flex flex-col h-screen overflow-hidden items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-amber/10 border border-accent-amber/15">
            <AlertTriangleIcon className="size-7 text-accent-amber" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
              API Key Required
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No Anthropic API key is configured. Set one up to start using Comms.
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="/settings"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-accent/20 bg-accent/8 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/12 transition-colors"
            >
              <SettingsIcon className="size-4" />
              Configure in Settings
            </a>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground/60">or via terminal</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <TerminalIcon className="size-3" />
                Set environment variable
              </div>
              <code className="text-xs text-foreground/60 font-mono">
                ANTHROPIC_API_KEY=sk-ant-...
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const promptInput = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        placeholder={sessionReady ? "Ask about contacts, emails, or approvals... (try /inbox, /contacts, /draft)" : "Loading session..."}
        disabled={!sessionReady}
      />
      <PromptInputFooter>
        <div className="relative inline-flex items-center">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="appearance-none bg-surface-1 border border-border rounded-lg px-3 py-1.5 pr-7 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/15 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 size-3 text-muted-foreground pointer-events-none" />
        </div>
        <PromptInputSubmit status={status} onStop={stop} />
      </PromptInputFooter>
    </PromptInput>
  );

  const isEmpty = messages.length === 0;

  return (
    <LayoutGroup>
      <div className="flex flex-col h-screen">
        {isEmpty ? (
          /* Empty state — hero + prompt centered vertically */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <motion.h1
              className="text-5xl font-bold text-accent hero-glow mb-4 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Comms
            </motion.h1>

            <div className="h-8 relative overflow-hidden mb-8">
              <AnimatePresence mode="wait">
                <motion.p
                  key={taglineIndex}
                  className="text-muted-foreground text-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {TAGLINES[taglineIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            <motion.div
              className="flex flex-wrap justify-center gap-2 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {SUGGESTIONS.map(({ label, icon: Icon, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSuggestion(prompt)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-1 border border-border text-sm text-muted-foreground hover:text-foreground/80 hover:border-foreground/15 transition-all cursor-pointer"
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </motion.div>

            {/* Prompt — centered under pills */}
            <motion.div
              layoutId="prompt-box"
              className="w-full max-w-3xl [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:bg-surface-1 [&_[data-slot=input-group]]:rounded-2xl"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {promptInput}
            </motion.div>
          </div>
        ) : (
          /* Chat state — messages + prompt at bottom */
          <>
            <Conversation className="flex-1">
              <ConversationContent className="max-w-3xl mx-auto w-full">
                {messages.map((msg) => (
                  <Message key={msg.id} from={msg.role}>
                    <MessageContent>
                      {msg.parts.map((part, i) => {
                        if (part.type === "text" && part.text) {
                          return (
                            <MessageResponse
                              key={i}
                              mode={
                                status === "streaming" &&
                                msg === messages[messages.length - 1] &&
                                msg.role === "assistant"
                                  ? "streaming"
                                  : "static"
                              }
                            >
                              {part.text}
                            </MessageResponse>
                          );
                        }
                        if (isToolUIPart(part)) {
                          const headerProps =
                            part.type === "dynamic-tool"
                              ? { type: part.type as "dynamic-tool", state: part.state, toolName: part.toolName }
                              : { type: part.type as `tool-${string}`, state: part.state };
                          return (
                            <Tool key={i}>
                              <ToolHeader {...headerProps} />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                {(part.state === "output-available" ||
                                  part.state === "output-error") && (
                                  <ToolOutput
                                    output={part.output}
                                    errorText={
                                      part.state === "output-error"
                                        ? String(part.output)
                                        : undefined
                                    }
                                  />
                                )}
                              </ToolContent>
                            </Tool>
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))}
                {(status === "submitted" || status === "streaming") &&
                  messages[messages.length - 1]?.role === "user" && (
                    <Shimmer className="text-sm">Thinking...</Shimmer>
                  )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <motion.div
              layoutId="prompt-box"
              className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:bg-surface-1 [&_[data-slot=input-group]]:rounded-2xl"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {promptInput}
            </motion.div>
          </>
        )}
      </div>
    </LayoutGroup>
  );
}
