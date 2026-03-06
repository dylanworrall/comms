import { tool } from "ai";
import { z } from "zod";
import { getSettings } from "@/lib/stores/settings";

export const settingsTools = {
  get_settings: tool({
    description:
      "View current Comms Client settings including agent mode configuration, email address, and model preferences.",
    inputSchema: z.object({}),
    execute: async () => {
      const settings = getSettings();
      return {
        message: "Current settings",
        settings,
      };
    },
  }),
};
