import { Command } from "commander";
import chalk from "chalk";
import { log } from "../../utils/logger.js";
import { activityStore } from "../stores.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function typeIcon(type: string): string {
  switch (type) {
    case "email_sent": return chalk.cyan("\u2709 sent    ");
    case "email_received": return chalk.blue("\u2709 recv    ");
    case "contact_added": return chalk.green("+ contact ");
    case "approval_resolved": return chalk.yellow("\u2713 approval");
    case "call_placed": return chalk.magenta("\u260E placed  ");
    case "call_initiated": return chalk.magenta("\u260E init    ");
    case "call_answered": return chalk.green("\u260E answer  ");
    case "call_ended": return chalk.gray("\u260E ended   ");
    case "call_recording_saved": return chalk.cyan("\u25CF recorded");
    default: return chalk.gray(String(type).padEnd(9));
  }
}

export const activityCommand = new Command("activity")
  .description("Show recent activity log")
  .option("-n, --limit <count>", "Number of entries to show", "20")
  .action(async (opts) => {
    const store = await activityStore();
    const limit = parseInt(opts.limit, 10);
    const entries = store.getActivity(limit);

    if (entries.length === 0) {
      log.info("No activity recorded yet.");
      return;
    }

    console.log();
    console.log(chalk.bold(`  Recent Activity (${entries.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const entry of entries) {
      const icon = typeIcon(entry.type);
      const date = chalk.gray(formatDate(entry.timestamp));
      const summary = chalk.white(entry.summary);
      console.log(`  ${icon}  ${date}  ${summary}`);
    }
    console.log();
  });
