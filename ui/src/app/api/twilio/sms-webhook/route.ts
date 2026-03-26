import { addSms } from "@/lib/stores/sms-store";
import { addActivity } from "@/lib/stores/activity";

export async function POST(req: Request) {
  // Twilio sends webhooks as form data
  const formData = await req.formData();

  const from = String(formData.get("From") || "");
  const to = String(formData.get("To") || "");
  const body = String(formData.get("Body") || "");
  const messageSid = String(formData.get("MessageSid") || "");

  if (from && body) {
    addSms({
      from,
      to,
      body,
      direction: "inbound",
      status: "received",
      timestamp: new Date().toISOString(),
      twilioSid: messageSid || undefined,
    });

    addActivity(
      "sms_received",
      `SMS from ${from}: ${body.slice(0, 80)}${body.length > 80 ? "..." : ""}`,
      { from, messageSid }
    );
  }

  // Respond with empty TwiML (acknowledge receipt, no auto-reply)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
