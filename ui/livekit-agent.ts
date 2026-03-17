/**
 * LiveKit Voice Agent — replaces the WebSocket voice server
 *
 * Pipeline: Twilio SIP → LiveKit Room → Agent
 *   Deepgram STT (~5ms) → Gemini 2.5 Flash LLM → Cartesia Sonic TTS (40-90ms TTFB)
 *
 * Usage: npx tsx livekit-agent.ts
 */

import { defineAgent, type JobContext, type JobProcess, cli } from "@livekit/agents";
import { voice } from "@livekit/agents";
import { STT } from "@livekit/agents-plugin-deepgram";
import { LLM } from "@livekit/agents-plugin-google";
import { TTS } from "@livekit/agents-plugin-cartesia";
import { VAD } from "@livekit/agents-plugin-silero";
import { config } from "dotenv";
import { resolve } from "path";

// Load env vars
config({ path: resolve(__dirname, ".env.local") });

// Import voice agent config store
import {
  getAgentByPhoneNumber,
  getVoiceAgentConfig,
  buildVoicePrompt,
} from "./src/lib/stores/voice-agent-store";

// Map our voice names to Cartesia voice IDs
// Cartesia has its own voice library — these are close matches
const CARTESIA_VOICE_MAP: Record<string, string> = {
  Achird: "a0e99841-438c-4a64-b679-ae501e7d6091",     // "Barbershop Man" - friendly
  Sulafat: "694f9389-aac1-45b6-b726-9d9369183238",     // "Reflective Woman" - warm
  Vindemiatrix: "c45bc5ec-dc68-4feb-8829-6e6b2748095d", // "Confident British" - gentle
  Algieba: "87748186-23bb-4571-8b6c-4db2b88e87ac",     // "Calm Lady" - smooth
  Achernar: "b7d50908-b17c-442d-ad8d-810c63997ed9",    // "California Girl" - soft
  Gacrux: "ee7ea9f8-c0c1-498c-9f62-dc2da49f5f44",      // "Wise Man" - mature
  Sadachbia: "156fb8d2-335b-4950-9cb3-a2d33f9c3e2e",   // "Cheerful Woman" - lively
  Kore: "2ee87190-8f84-4925-97da-e52547f9462c",         // "Classy British" - firm
  Puck: "fb26447f-308b-471e-8b00-8a9f7ff26aae",         // "Friendly Sidekick" - upbeat
};

const DEFAULT_CARTESIA_VOICE = "a0e99841-438c-4a64-b679-ae501e7d6091";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Preload the Silero VAD model for faster first-call response
    proc.userData.vad = await VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();

    console.log(`[LiveKit Agent] Connected to room: ${ctx.room.name}`);

    // Try to determine which phone number was called (from SIP metadata)
    const callerInfo = ctx.room.name || "";
    const participants = ctx.room.remoteParticipants;

    // Look up agent config by phone number or use default
    let agentConfig = getVoiceAgentConfig();

    // Check SIP participant attributes for the called number
    for (const [, participant] of participants) {
      const sipNumber = participant.attributes?.["sip.trunkPhoneNumber"]
        || participant.attributes?.["sip.calledNumber"]
        || "";
      if (sipNumber) {
        const matchedAgent = getAgentByPhoneNumber(sipNumber);
        if (matchedAgent) {
          agentConfig = matchedAgent;
          console.log(`[LiveKit Agent] Matched agent "${agentConfig.agentName}" for number ${sipNumber}`);
          break;
        }
      }
    }

    // Build the system prompt from agent config
    const systemPrompt = buildVoicePrompt(agentConfig);
    const cartesiaVoiceId = CARTESIA_VOICE_MAP[agentConfig.voice] || DEFAULT_CARTESIA_VOICE;

    console.log(`[LiveKit Agent] Using agent: ${agentConfig.agentName} (${agentConfig.activeTemplate}), voice: ${agentConfig.voice}`);

    // Create the voice pipeline agent
    const agent = new voice.Agent({
      vad: ctx.proc.userData.vad as VAD,
      stt: new STT(),
      llm: new LLM({
        model: "gemini-2.5-flash",
      }),
      tts: new TTS({
        voiceId: cartesiaVoiceId,
      }),
      instructions: systemPrompt,
    });

    // Start the agent session
    const session = await agent.start(ctx.room);

    // Generate initial greeting
    const agentName = agentConfig.agentName;
    const companyName = agentConfig.companyName;

    let greeting: string;
    switch (agentConfig.activeTemplate) {
      case "lead-gen":
      case "appointment-setter":
        greeting = `Hi, this is ${agentName} from ${companyName}. Do you have a quick moment?`;
        break;
      case "customer-support":
        greeting = `Thanks for calling ${companyName}, this is ${agentName}. How can I help you today?`;
        break;
      case "receptionist":
        greeting = `Thank you for calling ${companyName}, this is ${agentName}. How may I direct your call?`;
        break;
      case "survey":
        greeting = `Hi, this is ${agentName} from ${companyName}. We're reaching out to get your quick feedback — it'll only take about 2 minutes. Is now a good time?`;
        break;
      default:
        greeting = `Hi, this is ${agentName} from ${companyName}. How can I help you?`;
    }

    session.say(greeting);

    console.log(`[LiveKit Agent] Session started, greeting: "${greeting}"`);
  },
});

// Run the agent via CLI
cli.runApp(
  new cli.WorkerOptions({
    agent: resolve(__dirname, "livekit-agent.ts"),
  })
);
