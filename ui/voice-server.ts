/**
 * Voice WebSocket server — runs alongside Next.js dev server
 *
 * Accepts Twilio Media Stream WebSocket connections and bridges
 * them to either OpenAI Realtime or Gemini Live API for AI voice calls.
 *
 * Agent config (voice, engine, system prompt) is received via URL query
 * params from the Twilio webhook, making this server fully stateless.
 *
 * Audio pipelines:
 *   Gemini:  Twilio (mulaw 8kHz) → decode → upsample 16kHz → PCM 16-bit → Gemini Live API
 *            Gemini (PCM 24kHz) → low-pass → downsample 8kHz → mulaw → Twilio
 *   OpenAI:  Twilio (mulaw 8kHz / g711_ulaw) → OpenAI Realtime (accepts g711_ulaw natively)
 *            OpenAI (pcm16 24kHz) → downsample 8kHz → mulaw → Twilio
 *
 * Usage: npx tsx voice-server.ts
 */

import { WebSocketServer, WebSocket as WS } from "ws";
import { resolve } from "path";
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import * as alawmulaw from "alawmulaw";

// Load env vars from .env.local (local dev only — production uses Fly secrets)
try {
  require("dotenv").config({ path: resolve(process.cwd(), ".env.local") });
} catch {
  // dotenv not installed (production) — env vars set by host
}

const PORT = parseInt(process.env.VOICE_WS_PORT || "8765", 10);
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
  console.error("[Voice Server] Neither GOOGLE_GENERATIVE_AI_API_KEY nor OPENAI_API_KEY is set!");
  process.exit(1);
}

const FALLBACK_PROMPT = `You are a helpful AI voice assistant on a phone call.
Rules:
- Keep responses brief and conversational — this is a phone call, not a chat.
- Speak naturally. Be warm but efficient.
- Never use bullet points, markdown, or formatted text — you are speaking out loud.`;

/**
 * Convert Twilio mulaw 8kHz → PCM 16-bit 16kHz for Gemini
 * Upsample from 8kHz to 16kHz using linear interpolation for better quality
 */
function mulawToPcm16kBase64(mulawBase64: string): string {
  const mulawBytes = Buffer.from(mulawBase64, "base64");
  const mulawSamples = new Uint8Array(mulawBytes);

  // Decode mulaw 8-bit → PCM 16-bit at 8kHz
  const pcm8k = alawmulaw.mulaw.decode(mulawSamples);

  // Upsample 8kHz → 16kHz via linear interpolation
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length - 1; i++) {
    pcm16k[i * 2] = pcm8k[i];
    pcm16k[i * 2 + 1] = Math.round((pcm8k[i] + pcm8k[i + 1]) / 2);
  }
  // Last sample
  pcm16k[(pcm8k.length - 1) * 2] = pcm8k[pcm8k.length - 1];
  pcm16k[(pcm8k.length - 1) * 2 + 1] = pcm8k[pcm8k.length - 1];

  // Convert Int16Array to little-endian Buffer
  const pcmBuffer = Buffer.alloc(pcm16k.length * 2);
  for (let i = 0; i < pcm16k.length; i++) {
    pcmBuffer.writeInt16LE(pcm16k[i], i * 2);
  }

  return pcmBuffer.toString("base64");
}

/**
 * Simple low-pass FIR filter coefficients for anti-aliasing before 24kHz→8kHz
 * Cutoff ~3.5kHz (below 4kHz Nyquist of 8kHz output)
 * 15-tap windowed sinc filter with Hamming window
 */
const LP_FILTER: number[] = (() => {
  const N = 15;
  const fc = 3500 / 24000; // normalized cutoff
  const h = new Array(N);
  const mid = (N - 1) / 2;
  for (let i = 0; i < N; i++) {
    const x = i - mid;
    // sinc
    const sinc = x === 0 ? 1 : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    // Hamming window
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    h[i] = sinc * window;
  }
  // Normalize
  const sum = h.reduce((a, b) => a + b, 0);
  return h.map((v) => v / sum);
})();

/**
 * Convert Gemini PCM 24kHz → Twilio mulaw 8kHz
 * Applies anti-aliasing low-pass filter before downsampling to avoid artifacts
 */
function pcm24kToMulaw8kBase64(pcmBase64: string): string {
  const pcmBuffer = Buffer.from(pcmBase64, "base64");

  // Read PCM 16-bit samples (little-endian)
  const sampleCount = pcmBuffer.length / 2;
  const pcm24k = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    pcm24k[i] = pcmBuffer.readInt16LE(i * 2);
  }

  // Apply low-pass anti-aliasing filter
  const filtered = new Int16Array(sampleCount);
  const halfLen = Math.floor(LP_FILTER.length / 2);
  for (let i = 0; i < sampleCount; i++) {
    let sum = 0;
    for (let j = 0; j < LP_FILTER.length; j++) {
      const idx = i - halfLen + j;
      if (idx >= 0 && idx < sampleCount) {
        sum += pcm24k[idx] * LP_FILTER[j];
      }
    }
    filtered[i] = Math.max(-32768, Math.min(32767, Math.round(sum)));
  }

  // Downsample 24kHz → 8kHz (take every 3rd sample)
  const downsampledLength = Math.floor(sampleCount / 3);
  const downsampled = new Int16Array(downsampledLength);
  for (let i = 0; i < downsampledLength; i++) {
    downsampled[i] = filtered[i * 3];
  }

  // Encode PCM 16-bit → mulaw 8-bit
  const mulawSamples = alawmulaw.mulaw.encode(downsampled);

  return Buffer.from(mulawSamples).toString("base64");
}

const wss = new WebSocketServer({ host: "0.0.0.0", port: PORT });

console.log(`[Voice Server] WebSocket server listening on ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `ws://localhost:${PORT}`);
  const callSid = url.searchParams.get("callSid") || "unknown";
  const purpose = url.searchParams.get("purpose") || "";

  // Parse agent config from URL params (set by the Twilio webhook)
  const voiceEngine = (url.searchParams.get("voiceEngine") || "gemini") as "openai" | "gemini";
  const voice = url.searchParams.get("voice") || (voiceEngine === "openai" ? "coral" : "Achird");
  const agentName = url.searchParams.get("agentName") || "AI Assistant";
  const companyName = url.searchParams.get("companyName") || "";
  const systemPromptB64 = url.searchParams.get("systemPrompt") || "";
  const systemPrompt = systemPromptB64
    ? Buffer.from(systemPromptB64, "base64url").toString("utf-8")
    : FALLBACK_PROMPT;

  console.log(`[Voice Server] New connection for call ${callSid} | engine: ${voiceEngine}, voice: ${voice}, agent: ${agentName}`);

  let streamSid = "";
  let geminiSession: Awaited<ReturnType<InstanceType<typeof GoogleGenAI>["live"]["connect"]>> | null = null;
  let openaiWs: WS | null = null;
  let bridgeReady = false;
  let activeEngine: "gemini" | "openai" = voiceEngine;
  const mediaBuffer: string[] = [];

  function buildGreeting(): string {
    return purpose
      ? `You are now on a live phone call. You are ${agentName} from ${companyName}. You called this person for the following purpose: ${purpose}. Start by greeting them, introducing yourself, and delivering your message naturally.`
      : `You are now on a live phone call. You are ${agentName} from ${companyName}. A caller just connected. Greet them warmly and ask how you can help.`;
  }

  // ─── OpenAI Realtime Engine ───

  async function connectOpenAI() {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set — cannot use OpenAI engine");

    console.log(`[Voice Server] OpenAI Realtime — voice: ${voice}, agent: ${agentName}`);
    activeEngine = "openai";

    const oaiUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
    openaiWs = new WS(oaiUrl, {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on("open", () => {
      console.log(`[Voice Server] OpenAI Realtime connected for call ${callSid}`);

      // Configure session
      openaiWs!.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: systemPrompt,
          voice,
          input_audio_format: "g711_ulaw",
          output_audio_format: "pcm16",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 50,
            silence_duration_ms: 700,
          },
        },
      }));

      // Send initial greeting as a conversation item
      const greeting = buildGreeting();
      openaiWs!.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: greeting }],
        },
      }));
      openaiWs!.send(JSON.stringify({ type: "response.create" }));

      bridgeReady = true;

      // Flush buffered media — send raw mulaw directly (OpenAI accepts g711_ulaw)
      for (const buffered of mediaBuffer) {
        openaiWs!.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: buffered,
        }));
      }
      mediaBuffer.length = 0;

      console.log(`[Voice Server] OpenAI session configured for call ${callSid}`);
    });

    openaiWs.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "response.audio.delta" && msg.delta) {
          // OpenAI outputs pcm16 at 24kHz — downsample + mulaw encode for Twilio
          const mulawBase64 = pcm24kToMulaw8kBase64(msg.delta);
          if (ws.readyState === 1 && streamSid) {
            ws.send(JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: mulawBase64 },
            }));
          }
        }

        if (msg.type === "input_audio_buffer.speech_started") {
          // User started speaking — clear any pending audio on Twilio side
          if (ws.readyState === 1 && streamSid) {
            ws.send(JSON.stringify({ event: "clear", streamSid }));
          }
        }

        if (msg.type === "error") {
          console.error(`[Voice Server] OpenAI error:`, msg.error);
        }
      } catch (err) {
        console.error("[Voice Server] OpenAI message parse error:", err);
      }
    });

    openaiWs.on("close", (code, reason) => {
      console.log(`[Voice Server] OpenAI closed for call ${callSid}: ${code} ${reason}`);
      openaiWs = null;
    });

    openaiWs.on("error", (err) => {
      console.error(`[Voice Server] OpenAI error for call ${callSid}:`, err.message);
    });
  }

  // ─── Gemini Live Engine ───

  async function connectGemini() {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set — cannot use Gemini engine");

    console.log(`[Voice Server] Gemini Live — voice: ${voice}, agent: ${agentName}`);
    activeEngine = "gemini";

    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

    geminiSession = await genai.live.connect({
      model: "gemini-2.5-flash-native-audio-latest",
      callbacks: {
        onopen: () => {
          console.log(`[Voice Server] Gemini connected for call ${callSid}`);
        },
        onmessage: (msg: LiveServerMessage) => {
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/")) {
                const mulawBase64 = pcm24kToMulaw8kBase64(part.inlineData.data);
                if (ws.readyState === 1 && streamSid) {
                  ws.send(JSON.stringify({
                    event: "media",
                    streamSid,
                    media: { payload: mulawBase64 },
                  }));
                }
              }
            }
          }

          if (msg.serverContent?.interrupted) {
            if (ws.readyState === 1 && streamSid) {
              ws.send(JSON.stringify({ event: "clear", streamSid }));
            }
          }
        },
        onclose: (e: CloseEvent) => {
          console.log(`[Voice Server] Gemini closed for call ${callSid}:`, e.reason || "done");
          geminiSession = null;
        },
        onerror: (e: ErrorEvent) => {
          console.error(`[Voice Server] Gemini error for call ${callSid}:`, e.message);
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        thinkingConfig: {
          thinkingBudget: 0,
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH" as any,
            endOfSpeechSensitivity: "END_SENSITIVITY_HIGH" as any,
            silenceDurationMs: 700,
            prefixPaddingMs: 20,
          },
        },
        contextWindowCompression: {
          slidingWindow: {},
        },
      },
    });

    console.log(`[Voice Server] Gemini session ready for call ${callSid}`);
    bridgeReady = true;

    // Flush buffered media
    for (const buffered of mediaBuffer) {
      const pcmBase64 = mulawToPcm16kBase64(buffered);
      geminiSession.sendRealtimeInput({
        audio: { data: pcmBase64, mimeType: "audio/pcm;rate=16000" },
      });
    }
    mediaBuffer.length = 0;

    // Initial greeting
    const greeting = buildGreeting();
    geminiSession.sendClientContent({
      turns: [{ role: "user", parts: [{ text: greeting }] }],
      turnComplete: true,
    });

    console.log(`[Voice Server] Greeting sent for call ${callSid}`);
  }

  // ─── Connect dispatcher — picks engine based on URL params ───

  async function connectEngine() {
    console.log(`[Voice Server] Engine: ${voiceEngine} for call ${callSid}`);

    if (voiceEngine === "openai") {
      await connectOpenAI();
    } else {
      await connectGemini();
    }
  }

  // ─── Cleanup helper ───

  function closeEngine() {
    if (geminiSession) { geminiSession.close(); geminiSession = null; }
    if (openaiWs) { openaiWs.close(); openaiWs = null; }
  }

  // ─── Twilio message handler ───

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(typeof data === "string" ? data : data.toString());

      switch (msg.event) {
        case "connected":
          console.log(`[Voice Server] Twilio connected for call ${callSid}`);
          break;

        case "start":
          streamSid = msg.start?.streamSid || "";
          console.log(`[Voice Server] Stream started: ${streamSid}`);
          try {
            await connectEngine();
          } catch (err) {
            console.error(`[Voice Server] Failed to connect engine:`, err);
            ws.close();
          }
          break;

        case "media":
          if (bridgeReady) {
            if (activeEngine === "openai" && openaiWs && openaiWs.readyState === 1) {
              // OpenAI accepts g711_ulaw natively — send raw mulaw
              openaiWs.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.media.payload,
              }));
            } else if (activeEngine === "gemini" && geminiSession) {
              const pcmBase64 = mulawToPcm16kBase64(msg.media.payload);
              geminiSession.sendRealtimeInput({
                audio: { data: pcmBase64, mimeType: "audio/pcm;rate=16000" },
              });
            }
          } else {
            mediaBuffer.push(msg.media.payload);
          }
          break;

        case "stop":
          console.log(`[Voice Server] Stream stopped for call ${callSid}`);
          closeEngine();
          break;

        case "mark":
          break;
      }
    } catch (err) {
      console.error("[Voice Server] Error:", err);
    }
  });

  ws.on("close", () => {
    console.log(`[Voice Server] WebSocket closed for call ${callSid}`);
    closeEngine();
  });

  ws.on("error", (err) => {
    console.error(`[Voice Server] WebSocket error:`, err);
    closeEngine();
  });
});

wss.on("error", (err) => {
  console.error("[Voice Server] Server error:", err);
});

process.on("SIGINT", () => {
  console.log("[Voice Server] Shutting down...");
  wss.close();
  process.exit(0);
});
