import cron from "node-cron";
import type { CommsConfig } from "../types/index.js";
import { log } from "../utils/logger.js";

export function startScheduler(config: CommsConfig) {
  cron.schedule(config.cronSchedule, () => {
    log.step("cron", "Running scheduled jobs...");
    // Placeholder jobs — will be wired up later
    inboxTriage();
  });

  log.success("Cron scheduler started");
}

function inboxTriage() {
  log.debug("inbox-triage: checking for new emails...");
  // Placeholder — will integrate with email provider
}
