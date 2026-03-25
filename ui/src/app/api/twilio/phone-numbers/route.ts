import { NextResponse } from "next/server";
import { loadCommsEnv, saveCommsEnvVar } from "@/lib/env";
import { requireAuth } from "@/lib/api-auth";

loadCommsEnv();

// List available phone numbers for purchase
export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const country = url.searchParams.get("country") || "US";
  const type = url.searchParams.get("type") || "local"; // local, tollFree, mobile
  const areaCode = url.searchParams.get("areaCode") || undefined;
  const contains = url.searchParams.get("contains") || undefined;

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    const params: Record<string, unknown> = {
      voiceEnabled: true,
      smsEnabled: true,
      limit: 10,
    };

    if (areaCode) params.areaCode = parseInt(areaCode, 10);
    if (contains) params.contains = contains;

    let numbers;
    if (type === "tollFree") {
      numbers = await client.availablePhoneNumbers(country).tollFree.list(params);
    } else {
      numbers = await client.availablePhoneNumbers(country).local.list(params);
    }

    return NextResponse.json({
      numbers: numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
        capabilities: {
          voice: n.capabilities.voice,
          sms: n.capabilities.sms,
          mms: n.capabilities.mms,
        },
      })),
    });
  } catch (err) {
    console.error("Twilio search error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to search numbers: ${message}` },
      { status: 500 }
    );
  }
}

// Purchase a phone number
export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { phoneNumber } = body as { phoneNumber: string };

  if (!phoneNumber) {
    return NextResponse.json(
      { error: "phoneNumber is required" },
      { status: 400 }
    );
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    // Get the app's webhook URL for incoming calls
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      ...(appUrl
        ? {
            voiceUrl: `${appUrl}/api/twilio/webhook?type=inbound`,
            voiceMethod: "POST",
            statusCallback: `${appUrl}/api/twilio/webhook`,
            statusCallbackMethod: "POST",
          }
        : {}),
    });

    // Save as the default FROM number
    saveCommsEnvVar("TWILIO_FROM_NUMBER", purchased.phoneNumber);
    process.env.TWILIO_FROM_NUMBER = purchased.phoneNumber;

    return NextResponse.json({
      success: true,
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
      friendlyName: purchased.friendlyName,
    });
  } catch (err) {
    console.error("Twilio purchase error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to purchase number: ${message}` },
      { status: 500 }
    );
  }
}

// Update an existing phone number's webhook to point to the AI agent
export async function PATCH(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured." },
      { status: 400 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not set." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { phoneNumber } = body as { phoneNumber?: string };
  const targetNumber = phoneNumber || process.env.TWILIO_FROM_NUMBER;

  if (!targetNumber) {
    return NextResponse.json(
      { error: "No phone number to update." },
      { status: 400 }
    );
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    // Find the phone number SID
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: targetNumber,
      limit: 1,
    });

    if (numbers.length === 0) {
      return NextResponse.json(
        { error: `Number ${targetNumber} not found on this account.` },
        { status: 404 }
      );
    }

    // Update the voice URL to point to the AI inbound handler
    await client.incomingPhoneNumbers(numbers[0].sid).update({
      voiceUrl: `${appUrl}/api/twilio/webhook?type=inbound`,
      voiceMethod: "POST",
      statusCallback: `${appUrl}/api/twilio/webhook`,
      statusCallbackMethod: "POST",
    });

    return NextResponse.json({
      success: true,
      phoneNumber: targetNumber,
      voiceUrl: `${appUrl}/api/twilio/webhook?type=inbound`,
    });
  } catch (err) {
    console.error("Twilio update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update number: ${message}` },
      { status: 500 }
    );
  }
}
