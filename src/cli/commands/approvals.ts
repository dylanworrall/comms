import { Command } from "commander";
import chalk from "chalk";
import { log } from "../../utils/logger.js";
import { approvalsStore } from "../stores.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusBadge(status: string): string {
  switch (status) {
    case "pending": return chalk.yellow("\u25CF pending ");
    case "approved": return chalk.green("\u2713 approved");
    case "rejected": return chalk.red("\u2717 rejected");
    default: return status;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "send_email": return chalk.cyan("send email  ");
    case "reply_to_email": return chalk.cyan("reply email ");
    case "initiate_call": return chalk.magenta("call        ");
    case "add_contact": return chalk.green("add contact ");
    case "update_contact": return chalk.yellow("upd contact ");
    default: return chalk.gray(String(type).padEnd(12));
  }
}

function summarizeData(item: any): string {
  const d = item.data || {};
  switch (item.type) {
    case "send_email":
    case "reply_to_email":
      return chalk.white(`to: ${d.to || "?"}, subj: ${d.subject || "?"}`);
    case "initiate_call":
      return chalk.white(`${d.contactName || d.phoneNumber || "?"}`);
    case "add_contact":
    case "update_contact":
      return chalk.white(`${d.name || d.email || "?"}`);
    default:
      return "";
  }
}

export const approvalsCommand = new Command("approvals")
  .description("Manage pending approvals")
  .option("-a, --all", "Show all approvals (not just pending)")
  .action(async (opts) => {
    const store = await approvalsStore();
    const items = opts.all ? store.getApprovals() : store.getApprovals("pending");

    if (items.length === 0) {
      log.info(opts.all ? "No approvals found." : "No pending approvals.");
      return;
    }

    const label = opts.all ? "All Approvals" : "Pending Approvals";
    console.log();
    console.log(chalk.bold(`  ${label} (${items.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const item of items) {
      const id = chalk.gray(item.id.slice(0, 8));
      const type = typeLabel(item.type);
      const status = statusBadge(item.status);
      const date = chalk.gray(formatDate(item.createdAt));
      const summary = summarizeData(item);
      console.log(`  ${id}  ${type}  ${status}  ${date}  ${summary}`);
    }
    console.log();
  });

approvalsCommand
  .command("show <id>")
  .description("Show approval details by ID (prefix match)")
  .action(async (id: string) => {
    const store = await approvalsStore();
    const all = store.getApprovals();
    const match = all.find((a: any) => a.id.startsWith(id));
    if (!match) {
      log.error(`Approval not found: ${id}`);
      return;
    }
    console.log();
    console.log(chalk.bold("ID:      ") + match.id);
    console.log(chalk.bold("Type:    ") + match.type);
    console.log(chalk.bold("Status:  ") + statusBadge(match.status));
    console.log(chalk.bold("Created: ") + formatDate(match.createdAt));
    if (match.resolvedAt) console.log(chalk.bold("Resolved:") + " " + formatDate(match.resolvedAt));
    console.log(chalk.bold("Data:"));
    for (const [key, value] of Object.entries(match.data || {})) {
      console.log(`  ${chalk.gray(key)}: ${value}`);
    }
    console.log();
  });

approvalsCommand
  .command("approve <id>")
  .description("Approve a pending action by ID (prefix match)")
  .action(async (id: string) => {
    const store = await approvalsStore();
    const all = store.getApprovals("pending");
    const match = all.find((a: any) => a.id.startsWith(id));
    if (!match) {
      log.error(`Pending approval not found: ${id}`);
      return;
    }
    const result = store.resolveApproval(match.id, "approved");
    if (result) {
      log.success(`Approved: ${result.type} (${result.id.slice(0, 8)})`);
    } else {
      log.error("Failed to approve — may already be resolved.");
    }
  });

approvalsCommand
  .command("reject <id>")
  .description("Reject a pending action by ID (prefix match)")
  .action(async (id: string) => {
    const store = await approvalsStore();
    const all = store.getApprovals("pending");
    const match = all.find((a: any) => a.id.startsWith(id));
    if (!match) {
      log.error(`Pending approval not found: ${id}`);
      return;
    }
    const result = store.resolveApproval(match.id, "rejected");
    if (result) {
      log.success(`Rejected: ${result.type} (${result.id.slice(0, 8)})`);
    } else {
      log.error("Failed to reject — may already be resolved.");
    }
  });
