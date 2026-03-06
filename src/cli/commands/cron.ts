import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { startScheduler } from "../../cron/scheduler.js";
import { log } from "../../utils/logger.js";

export const cronCommand = new Command("cron")
  .description("Start the cron scheduler for background jobs")
  .action(async () => {
    const config = await loadConfig();
    if (!config.cronEnabled) {
      log.warn("Cron is disabled in config. Enable it with cronEnabled: true");
      return;
    }
    log.info(`Starting cron scheduler (${config.cronSchedule})...`);
    startScheduler(config);
  });
