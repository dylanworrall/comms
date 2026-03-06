"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  KeyIcon,
  ExternalLinkIcon,
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  TerminalIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  MessageSquareIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthState = "choose" | "validating" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("choose");
  const [error, setError] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setMaskedKey(data.masked || "");
          setState("success");
        }
      })
      .catch(() => {});
  }, []);

  const handleApiKey = useCallback(async (key: string) => {
    setState("validating");
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "api-key", apiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedKey(data.masked || "");
        setState("success");
      } else {
        setError(data.error || "Authentication failed");
        setState("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }, []);

  const handleSetupToken = useCallback(async (token: string) => {
    setState("validating");
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "setup-token", token }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedKey(data.masked || "");
        setState("success");
      } else {
        setError(data.error || "Authentication failed");
        setState("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header — CLIENT-SPECIFIC: icon, name, description */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquareIcon className="size-8 text-[#007AFF]" /> {/* CLIENT-SPECIFIC icon */}
          </div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Comms Client</h1> {/* CLIENT-SPECIFIC name */}
          <p className="text-[#8E8E93] text-sm mt-1">
            Connect your Anthropic account to get started.
          </p>
        </div>

        {/* Success State */}
        {state === "success" && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <CheckCircleIcon className="size-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#1C1C1E] mb-1">Connected</h2>
            {maskedKey && (
              <p className="text-sm text-[#8E8E93] font-mono mb-4">{maskedKey}</p>
            )}
            <Button onClick={() => router.push("/")} className="w-full bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-xl">
              Go to Chat <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}

        {/* Validating State */}
        {state === "validating" && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <LoaderIcon className="size-12 text-[#007AFF] animate-spin mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Validating...</h2>
            <p className="text-sm text-[#8E8E93] mt-1">Checking credentials with Anthropic.</p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <XCircleIcon className="size-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setState("choose"); setError(""); }}
              className="w-full rounded-xl border-[#E5E5EA]"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Choose Auth Method */}
        {state === "choose" && (
          <div className="space-y-3">
            {/* Method 1: API Key (recommended) */}
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                onClick={() => {
                  window.open("https://console.anthropic.com/settings/keys", "_blank");
                  setShowKeyInput(true);
                }}
                className="flex items-start gap-3 w-full text-left cursor-pointer"
              >
                <KeyIcon className="size-5 text-[#007AFF] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1C1C1E]">Get API Key</span>
                    <span className="text-[10px] font-medium text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded-full">
                      RECOMMENDED
                    </span>
                    <ExternalLinkIcon className="size-3 text-[#8E8E93]" />
                  </div>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    Opens console.anthropic.com to create or copy your API key
                  </p>
                </div>
              </button>

              {showKeyInput && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-2 pr-9 text-sm text-[#1C1C1E] placeholder:text-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#007AFF]/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                      >
                        {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApiKey(apiKeyInput.trim())}
                      disabled={!apiKeyInput.trim().startsWith("sk-ant-")}
                      className="h-[38px] bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-xl"
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              )}

              {!showKeyInput && (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="mt-2 text-xs text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                >
                  Already have a key? Paste it here
                </button>
              )}
            </div>

            {/* Method 2: Claude Subscription (setup-token) */}
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="flex items-start gap-3 w-full text-left cursor-pointer"
              >
                <TerminalIcon className="size-5 text-[#8E8E93] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-[#1C1C1E]">
                    Claude Subscription (setup-token)
                  </span>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    Use your Claude Pro/Max subscription via setup token
                  </p>
                </div>
              </button>

              {showTokenInput && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-[#8E8E93]">Run this in your terminal:</div>
                  <div className="rounded-xl bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2">
                    <code className="text-sm text-[#007AFF] font-mono">claude setup-token</code>
                  </div>
                  <div className="text-xs text-[#8E8E93]">Then paste the token below:</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showToken ? "text" : "password"}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste token..."
                        className="w-full rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-2 pr-9 text-sm text-[#1C1C1E] placeholder:text-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#007AFF]/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] cursor-pointer"
                      >
                        {showToken ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSetupToken(tokenInput.trim())}
                      disabled={!tokenInput.trim()}
                      className="h-[38px] bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-xl"
                    >
                      Connect
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangleIcon className="size-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600">
                      Uses your Claude Pro/Max subscription. May be restricted by Anthropic TOS.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
