import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";
import { getAllCalls } from "@/lib/stores/calls-store";
import { addActivity } from "@/lib/stores/activity";

loadCommsEnv();

export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  // TwiML response for outbound calls (regular dial)
  if (type === "twiml") {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer-dual" recordingStatusCallback="/api/twilio/webhook?type=recording">
    <Number>${url.searchParams.get("To") || ""}</Number>
  </Dial>
</Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // TwiML for AI voice calls — connects to Gemini via WebSocket Media Stream
  if (type === "voice-ai") {
    const wsHost = process.env.VOICE_WS_HOST || "localhost:8765";
    const callSid = url.searchParams.get("CallSid") || "";
    const purpose = url.searchParams.get("purpose") || "";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${wsHost}?callSid=${encodeURIComponent(callSid)}&amp;purpose=${encodeURIComponent(purpose)}">
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // TwiML for inbound calls — route to AI voice agent
  if (type === "inbound") {
    const wsHost = process.env.VOICE_WS_HOST || "localhost:8765";
    const wsProtocol = wsHost.includes("localhost") ? "wss" : "wss";
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to your AI assistant.</Say>
  <Connect>
    <Stream url="${wsProtocol}://${wsHost}?callSid=inbound">
      <Parameter name="direction" value="inbound" />
    </Stream>
  </Connect>
</Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Parse form-encoded body (Twilio sends webhooks as form data)
  const formData = await req.formData();
  const payload: Record<string, string> = {};
  formData.forEach((value, key) => {
    payload[key] = String(value);
  });

  const callSid = payload.CallSid;
  const callStatus = payload.CallStatus;

  console.log(`[Twilio webhook] ${type || callStatus}`, callSid);

  try {
    // Recording status callback
    if (type === "recording") {
      const recordingUrl = payload.RecordingUrl;
      addActivity(
        "call_recording_saved",
        `Call recording saved${recordingUrl ? `: ${recordingUrl}` : ""}`,
        { callSid, recordingUrl }
      );
      return NextResponse.json({ received: true });
    }

    // Status callback events
    switch (callStatus) {
      case "initiated":
      case "queued":
      case "ringing": {
        addActivity(
          "call_initiated",
          `Call ${callStatus}: ${payload.From} -> ${payload.To}`,
          { callSid }
        );
        break;
      }

      case "in-progress": {
        addActivity(
          "call_answered",
          `Call answered: ${payload.From} -> ${payload.To}`,
          { callSid }
        );
        break;
      }

      case "completed": {
        const calls = getAllCalls();
        const matchingCall = calls.find(
          (c) => c.notes?.includes(`sid=${callSid}`)
        );

        const duration = parseInt(payload.CallDuration || "0", 10);

        if (matchingCall) {
          addActivity(
            "call_ended",
            `Call ended: ${matchingCall.contactName} (${matchingCall.phoneNumber}), duration: ${duration}s`,
            { callSid, duration, callId: matchingCall.id }
          );
        } else {
          addActivity(
            "call_ended",
            `Call ended: ${payload.From} -> ${payload.To}, duration: ${duration}s`,
            { callSid, duration }
          );
        }
        break;
      }

      case "busy":
      case "no-answer":
      case "canceled":
      case "failed": {
        addActivity(
          "call_ended",
          `Call ${callStatus}: ${payload.From} -> ${payload.To}`,
          { callSid, status: callStatus }
        );
        break;
      }

      default:
        console.log(`[Twilio webhook] Unhandled status: ${callStatus}`);
    }
  } catch (err) {
    console.error("[Twilio webhook] Error processing:", err);
  }

  return NextResponse.json({ received: true });
}
