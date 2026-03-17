"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  MessageSquareIcon,
  MailIcon,
  LockIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

const isCloudMode = !!process.env.NEXT_PUBLIC_CONVEX_URL;

type Mode = "signin" | "signup";

export default function LoginPage() {
  // Local mode has no login page — API key is configured in Settings
  if (!isCloudMode) {
    redirect("/");
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    }>
      <CloudLoginPage />
    </Suspense>
  );
}

/* ─── Cloud Mode: BetterAuth Login ─── */
function CloudLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (signUpError) {
          setError(signUpError.message || "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message || "Sign in failed");
          setLoading(false);
          return;
        }
      }

      // Ensure user record exists in credits system
      await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || email.split("@")[0] }),
      });

      setSuccess(true);
      setTimeout(() => { window.location.href = callbackUrl; }, 800);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-surface-1 p-8 text-center shadow-elevation-2">
            <CheckCircleIcon className="size-12 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {mode === "signup" ? "Account Created" : "Welcome Back"}
            </h2>
            <p className="text-sm text-muted mb-4">Redirecting to chat...</p>
            <Button
              onClick={() => { window.location.href = callbackUrl; }}
              className="w-full bg-accent hover:bg-accent/80 text-white rounded-xl"
            >
              Go to Chat <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquareIcon className="size-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Comms Client</h1>
          <p className="text-muted text-sm mt-1">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-surface-1 border border-border p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); }}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer ${
              mode === "signin"
                ? "bg-surface-2 text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer ${
              mode === "signup"
                ? "bg-surface-2 text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-1 p-5 space-y-4 shadow-elevation-1">
            {/* Name (sign-up only) */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Email</label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-muted mb-1.5 block">Password</label>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <XCircleIcon className="size-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-accent hover:bg-accent/80 text-white rounded-xl h-11 text-sm font-medium"
          >
            {loading ? (
              <>
                <LoaderIcon className="size-4 animate-spin mr-2" />
                {mode === "signin" ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              <>
                {mode === "signin" ? "Sign In" : "Create Account"}
                <ArrowRightIcon className="size-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted mt-6">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="text-accent hover:underline cursor-pointer"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
