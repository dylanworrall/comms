"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface CallState {
  status: "idle" | "connecting" | "ringing" | "active" | "ended";
  duration: number;
  callId: string | null;
  error: string | null;
  isMuted: boolean;
}

const INITIAL_STATE: CallState = {
  status: "idle",
  duration: 0,
  callId: null,
  error: null,
  isMuted: false,
};

export function useTwilioCall() {
  const [callState, setCallState] = useState<CallState>(INITIAL_STATE);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeCallRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const contactInfoRef = useRef<{ name: string; phone: string }>({
    name: "",
    phone: "",
  });

  // Clean up timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start duration timer
  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallState((prev) => ({ ...prev, duration: elapsed }));
    }, 1000);
  }, [stopTimer]);

  // Save call record after call ends
  const saveCallRecord = useCallback(
    async (duration: number) => {
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: contactInfoRef.current.phone,
            contactName: contactInfoRef.current.name || "Unknown",
            direction: "outbound",
            status: "completed",
            duration,
            direct: true,
          }),
        });
      } catch (err) {
        console.error("Failed to save call record:", err);
      }
    },
    []
  );

  // Initialize Twilio Device
  const initDevice = useCallback(async () => {
    try {
      const res = await fetch("/api/twilio/token");
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 400) {
          setConfigured(false);
          return;
        }
        throw new Error(data.error || "Failed to get token");
      }

      const { token } = await res.json();
      setConfigured(true);

      // Dynamically import Twilio Voice SDK (browser-only)
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(token, {
        codecPreferences: ["opus", "pcmu"] as any,
        enableImplicitSubscription: true,
      });

      device.on("registered", () => {
        console.log("[Twilio] Device ready");
      });

      device.on("error", (error: Error) => {
        console.error("[Twilio] Error:", error);
        setCallState((prev) => ({
          ...prev,
          error: "Connection error. Try refreshing.",
          status: prev.status === "active" ? "ended" : prev.status,
        }));
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      console.error("[Twilio] Init error:", err);
      setConfigured(false);
      setCallState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to initialize",
      }));
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initDevice();

    return () => {
      stopTimer();
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        deviceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dial a phone number
  const dial = useCallback(
    async (phoneNumber: string, contactName?: string) => {
      if (!deviceRef.current) {
        setCallState((prev) => ({
          ...prev,
          error: "Device not connected. Refresh the page.",
        }));
        return;
      }

      if (callState.status !== "idle") {
        setCallState((prev) => ({
          ...prev,
          error: "A call is already in progress.",
        }));
        return;
      }

      contactInfoRef.current = {
        name: contactName || "Unknown",
        phone: phoneNumber,
      };

      try {
        setCallState({
          status: "connecting",
          duration: 0,
          callId: null,
          error: null,
          isMuted: false,
        });

        const call = await deviceRef.current.connect({
          params: {
            To: phoneNumber,
            CallerName: "Comms Client",
          },
        });

        activeCallRef.current = call;
        setCallState((prev) => ({
          ...prev,
          status: "ringing",
        }));

        call.on("accept", () => {
          setCallState((prev) => ({ ...prev, status: "active" }));
          startTimer();
        });

        call.on("disconnect", () => {
          const duration = startTimeRef.current
            ? Math.floor((Date.now() - startTimeRef.current) / 1000)
            : 0;
          stopTimer();
          setCallState((prev) => ({
            ...prev,
            status: "ended",
            duration,
          }));
          activeCallRef.current = null;
          if (duration > 0) {
            saveCallRecord(duration);
          }
          setTimeout(() => {
            setCallState(INITIAL_STATE);
          }, 3000);
        });

        call.on("cancel", () => {
          stopTimer();
          setCallState(INITIAL_STATE);
          activeCallRef.current = null;
        });

        call.on("error", (error: Error) => {
          console.error("[Twilio] Call error:", error);
          stopTimer();
          setCallState({
            ...INITIAL_STATE,
            error: error.message || "Call failed",
          });
          activeCallRef.current = null;
        });
      } catch (err) {
        console.error("[Twilio] Dial error:", err);
        setCallState({
          ...INITIAL_STATE,
          error: err instanceof Error ? err.message : "Failed to place call",
        });
      }
    },
    [callState.status, startTimer, stopTimer, saveCallRecord]
  );

  // Hang up the active call
  const hangup = useCallback(() => {
    if (activeCallRef.current) {
      try {
        activeCallRef.current.disconnect();
      } catch {
        const duration = startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;
        stopTimer();
        activeCallRef.current = null;
        setCallState(INITIAL_STATE);
        if (duration > 0) {
          saveCallRecord(duration);
        }
      }
    } else {
      setCallState(INITIAL_STATE);
    }
  }, [stopTimer, saveCallRecord]);

  // Mute the mic
  const mute = useCallback(() => {
    if (activeCallRef.current) {
      try {
        activeCallRef.current.mute(true);
        setCallState((prev) => ({ ...prev, isMuted: true }));
      } catch (err) {
        console.error("[Twilio] Mute error:", err);
      }
    }
  }, []);

  // Unmute the mic
  const unmute = useCallback(() => {
    if (activeCallRef.current) {
      try {
        activeCallRef.current.mute(false);
        setCallState((prev) => ({ ...prev, isMuted: false }));
      } catch (err) {
        console.error("[Twilio] Unmute error:", err);
      }
    }
  }, []);

  return {
    callState,
    configured,
    dial,
    hangup,
    mute,
    unmute,
  };
}
