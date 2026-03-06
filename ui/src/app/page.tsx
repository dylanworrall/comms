"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import { InboxIcon, UsersIcon, MailIcon, ShieldCheckIcon } from "lucide-react";

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
  const { messages, sendMessage, status, stop } = useChat();
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (!data.connected) {
          router.replace("/login");
        } else {
          setAuthChecked(true);
        }
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
      let text = message.text.trim();
      if (!text) return;

      // Slash command expansion
      const cmd = text.toLowerCase();
      if (SLASH_COMMANDS[cmd]) {
        text = SLASH_COMMANDS[cmd];
      }

      sendMessage({ text });
    },
    [sendMessage]
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

  return (
    <div className="flex flex-col h-screen">
      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              {/* Hero title */}
              <motion.h1
                className="text-5xl font-bold text-accent hero-glow mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                Comms
              </motion.h1>

              {/* Rotating tagline */}
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

              {/* Suggestion chips */}
              <motion.div
                className="flex flex-wrap justify-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                {SUGGESTIONS.map(({ label, icon: Icon, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSuggestion(prompt)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors cursor-pointer"
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            messages.map((msg) => (
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
            ))
          )}
          {(status === "submitted" || status === "streaming") &&
            messages[messages.length - 1]?.role === "user" && (
              <Shimmer className="text-sm">Thinking...</Shimmer>
            )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea placeholder="Ask about contacts, emails, or approvals... (try /inbox, /contacts, /draft)" />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
