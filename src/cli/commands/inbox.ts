import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { log } from "../../utils/logger.js";
import { inboxStore } from "../stores.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "\u2026" : str;
}

function printEmailRow(email: any): void {
  const read = email.read ? " " : chalk.cyan("\u2022");
  const flag = email.flagged ? chalk.yellow("\u2605") : " ";
  const id = chalk.gray(email.id.slice(0, 8));
  const from = chalk.white(truncate(email.fromName || email.from, 20).padEnd(20));
  const subject = truncate(email.subject, 40).padEnd(40);
  const date = chalk.gray(formatDate(email.timestamp));
  console.log(`  ${read} ${flag} ${id}  ${from}  ${subject}  ${date}`);
}

function printEmailDetail(email: any): void {
  console.log();
  console.log(chalk.bold("Subject: ") + email.subject);
  console.log(chalk.bold("From:    ") + `${email.fromName} <${email.from}>`);
  console.log(chalk.bold("To:      ") + email.to);
  if (email.cc) console.log(chalk.bold("Cc:      ") + email.cc);
  console.log(chalk.bold("Date:    ") + formatDate(email.timestamp));
  console.log(chalk.bold("Folder:  ") + email.folder);
  if (email.tags?.length) console.log(chalk.bold("Tags:    ") + email.tags.join(", "));
  if (email.aiSummary) console.log(chalk.bold("Summary: ") + chalk.italic(email.aiSummary));
  console.log(chalk.gray("\u2500".repeat(60)));
  console.log();
  console.log(email.body);
  console.log();
}

export const inboxCommand = new Command("inbox")
  .description("Manage your inbox")
  .option("--unread", "Show unread emails only")
  .option("--flagged", "Show flagged emails only")
  .option("-n, --limit <count>", "Number of emails to show", "20")
  .option("-f, --folder <folder>", "Filter by folder (inbox, sent, drafts, trash)")
  .action(async (opts) => {
    const store = await inboxStore();
    const emails = store.getEmails({
      limit: parseInt(opts.limit, 10),
      unreadOnly: opts.unread || false,
      flagged: opts.flagged || false,
      folder: opts.folder,
    });

    if (emails.length === 0) {
      log.info("No emails found.");
      return;
    }

    console.log();
    console.log(chalk.bold(`  Inbox (${emails.length} emails)`));
    console.log(chalk.gray("  " + "\u2500".repeat(58)));
    for (const email of emails) {
      printEmailRow(email);
    }
    console.log();
  });

inboxCommand
  .command("read <id>")
  .description("Read a full email by ID (prefix match)")
  .action(async (id: string) => {
    const store = await inboxStore();
    const all = store.getAllEmails();
    const match = all.find((e: any) => e.id.startsWith(id));
    if (!match) {
      log.error(`Email not found: ${id}`);
      return;
    }
    store.markRead(match.id);
    printEmailDetail(match);
  });

inboxCommand
  .command("compose")
  .description("Compose a new draft email")
  .action(async () => {
    const store = await inboxStore();
    const answers = await inquirer.prompt([
      { type: "input", name: "to", message: "To:" },
      { type: "input", name: "subject", message: "Subject:" },
      {
        type: "editor",
        name: "body",
        message: "Body (opens editor):",
        default: "",
      },
    ]);

    if (!answers.to || !answers.subject) {
      log.warn("Cancelled — to and subject are required.");
      return;
    }

    const email = store.addEmail({
      from: "you@example.com",
      fromName: "You",
      to: answers.to,
      subject: answers.subject,
      body: answers.body,
      timestamp: new Date().toISOString(),
      read: true,
      flagged: false,
      folder: "drafts",
    });

    log.success(`Draft saved: ${email.id.slice(0, 8)}`);
  });

inboxCommand
  .command("search <query>")
  .description("Search emails by subject, sender, or body")
  .action(async (query: string) => {
    const store = await inboxStore();
    const all = store.getAllEmails();
    const q = query.toLowerCase();
    const results = all.filter(
      (e: any) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        (e.fromName || "").toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)
    );

    if (results.length === 0) {
      log.info(`No emails matching "${query}".`);
      return;
    }

    console.log();
    console.log(chalk.bold(`  Search results for "${query}" (${results.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(58)));
    for (const email of results) {
      printEmailRow(email);
    }
    console.log();
  });
