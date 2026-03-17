#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { configCommand } from "./commands/config.js";
import { uiCommand } from "./commands/ui.js";
import { cronCommand } from "./commands/cron.js";
import { inboxCommand } from "./commands/inbox.js";
import { contactsCommand } from "./commands/contacts.js";
import { callsCommand } from "./commands/calls.js";
import { voiceCommand } from "./commands/voice.js";
import { approvalsCommand } from "./commands/approvals.js";
import { activityCommand } from "./commands/activity.js";
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
program.addCommand(inboxCommand);
program.addCommand(contactsCommand);
program.addCommand(callsCommand);
program.addCommand(voiceCommand);
program.addCommand(approvalsCommand);
program.addCommand(activityCommand);

if (process.argv.length <= 2) {
  printBanner();
  program.outputHelp();
  process.exit(0);
}

program.parse();
