#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { configCommand } from "./commands/config.js";
import { uiCommand } from "./commands/ui.js";
import { cronCommand } from "./commands/cron.js";
import { setVerbose } from "../utils/logger.js";
import { printBanner } from "./banner.js";

const program = new Command();

program
  .name("comms")
  .description("AI-powered communication client: contacts, email, calls, and voice")
  .version("1.0.0")
  .option("--verbose", "Enable debug logging")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) setVerbose(true);
  });

program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(configCommand);
program.addCommand(uiCommand);
program.addCommand(cronCommand);

if (process.argv.length <= 2) {
  printBanner();
  program.outputHelp();
  process.exit(0);
}

program.parse();
