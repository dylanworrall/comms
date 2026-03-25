import { z } from "zod";

// Stub tools that return mock data — no real calendar integration yet.

function getMockEvents() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return [
    {
      id: "evt-001",
      title: "Q2 Strategy Meeting",
      date: today,
      time: "14:00",
      duration: 60,
      attendees: ["sarah.chen@acmecorp.com", "you@example.com"],
      location: "Zoom",
    },
    {
      id: "evt-002",
      title: "1:1 with James Wright",
      date: today,
      time: "16:30",
      duration: 30,
      attendees: ["james.wright@venturelabs.io", "you@example.com"],
      location: "Google Meet",
    },
    {
      id: "evt-003",
      title: "Sprint Planning",
      date: tomorrow,
      time: "10:00",
      duration: 45,
      attendees: ["dev-team@company.com", "you@example.com"],
      location: "Office — Room 3B",
    },
    {
      id: "evt-004",
      title: "Investor Update Call",
      date: tomorrow,
      time: "15:00",
      duration: 30,
      attendees: ["marcus.j@venture.vc", "you@example.com"],
      location: "Phone",
    },
    {
      id: "evt-005",
      title: "Design Review — Dashboard v2",
      date: dayAfter,
      time: "11:00",
      duration: 60,
      attendees: ["maya.patel@designhub.co", "dev-team@company.com", "you@example.com"],
      location: "Figma + Zoom",
    },
  ];
}

export const listEventsTool = {
  name: "list_events",
  description:
    "List upcoming calendar events. Returns mock data (no real calendar integration yet).",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of events to return (default: 5)"),
  }),
  execute: async ({ limit }: { limit?: number }) => {
    const events = getMockEvents().slice(0, limit ?? 5);
    return {
      message: `${events.length} upcoming event(s)`,
      events,
    };
  },
};

export const createEventTool = {
  name: "create_event",
  description:
    "Create a new calendar event. Returns a mock confirmation (no real calendar integration yet).",
  inputSchema: z.object({
    title: z.string().describe("Event title"),
    date: z
      .string()
      .describe("Event date in YYYY-MM-DD format"),
    time: z
      .string()
      .describe("Start time in HH:MM 24-hour format"),
    duration: z
      .number()
      .describe("Duration in minutes"),
    attendees: z
      .array(z.string())
      .default([])
      .describe("List of attendee email addresses"),
    location: z
      .string()
      .optional()
      .describe("Meeting location or video link"),
  }),
  execute: async ({ title, date, time, duration, attendees, location }: {
    title: string;
    date: string;
    time: string;
    duration: number;
    attendees: string[];
    location?: string;
  }) => {
    const mockId = `evt-${Date.now().toString(36)}`;
    return {
      message: `Event created: "${title}" on ${date} at ${time} (${duration} min)`,
      event: {
        id: mockId,
        title,
        date,
        time,
        duration,
        attendees,
        location: location ?? "TBD",
      },
    };
  },
};

export const checkAvailabilityTool = {
  name: "check_availability",
  description:
    "Check calendar availability for a given date and time range. Returns mock availability slots (no real calendar integration yet).",
  inputSchema: z.object({
    date: z.string().describe("Date to check in YYYY-MM-DD format"),
    startTime: z
      .string()
      .optional()
      .describe("Start of time range in HH:MM format (default: 09:00)"),
    endTime: z
      .string()
      .optional()
      .describe("End of time range in HH:MM format (default: 17:00)"),
  }),
  execute: async ({ date, startTime, endTime }: { date: string; startTime?: string; endTime?: string }) => {
    const start = startTime ?? "09:00";
    const end = endTime ?? "17:00";

    // Mock busy and available slots
    const busySlots = [
      { start: "10:00", end: "10:45", event: "Sprint Planning" },
      { start: "14:00", end: "15:00", event: "Q2 Strategy Meeting" },
    ];

    const availableSlots = [
      { start: "09:00", end: "10:00" },
      { start: "10:45", end: "12:00" },
      { start: "13:00", end: "14:00" },
      { start: "15:00", end: "17:00" },
    ];

    return {
      message: `Availability for ${date} (${start} — ${end})`,
      date,
      range: { start, end },
      busySlots,
      availableSlots,
    };
  },
};
