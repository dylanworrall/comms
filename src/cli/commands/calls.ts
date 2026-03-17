import { Command } from "commander";
import chalk from "chalk";
import { log } from "../../utils/logger.js";
import { callsStore } from "../stores.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusIcon(status: string): string {
  switch (status) {
    case "completed": return chalk.green("\u2713");
    case "missed": return chalk.red("\u2717");
    case "voicemail": return chalk.yellow("\u260E");
    default: return " ";
  }
}

function directionLabel(dir: string): string {
  return dir === "inbound" ? chalk.blue("\u2190 in ") : chalk.magenta("\u2192 out");
}

export const callsCommand = new Command("calls")
  .description("View call history")
  .action(async () => {
    const store = await callsStore();
    const calls = store.getAllCalls();

    if (calls.length === 0) {
      log.info("No calls found.");
      return;
    }

    const sorted = [...calls].sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    console.log();
    console.log(chalk.bold(`  Calls (${sorted.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const call of sorted) {
      const id = chalk.gray(call.id.slice(0, 8));
      const icon = statusIcon(call.status);
      const dir = directionLabel(call.direction);
      const name = chalk.white(call.contactName.padEnd(20));
      const phone = chalk.gray(call.phoneNumber.padEnd(16));
      const dur = chalk.cyan(formatDuration(call.duration).padEnd(8));
      const date = chalk.gray(formatDate(call.timestamp));
      console.log(`  ${icon} ${id}  ${dir}  ${name}  ${phone}  ${dur}  ${date}`);
    }
    console.log();
  });

callsCommand
  .command("show <id>")
  .description("Show call details by ID (prefix match)")
  .action(async (id: string) => {
    const store = await callsStore();
    const all = store.getAllCalls();
    const match = all.find((c: any) => c.id.startsWith(id));
    if (!match) {
      log.error(`Call not found: ${id}`);
      return;
    }
    console.log();
    console.log(chalk.bold("Contact:   ") + match.contactName);
    console.log(chalk.bold("Phone:     ") + match.phoneNumber);
    console.log(chalk.bold("Direction: ") + match.direction);
    console.log(chalk.bold("Status:    ") + match.status);
    console.log(chalk.bold("Duration:  ") + formatDuration(match.duration));
    console.log(chalk.bold("Date:      ") + formatDate(match.timestamp));
    if (match.notes) console.log(chalk.bold("Notes:     ") + match.notes);
    if (match.transcript) {
      console.log();
      console.log(chalk.bold("Transcript:"));
      console.log(chalk.gray("\u2500".repeat(60)));
      console.log(match.transcript);
    }
    console.log();
  });
