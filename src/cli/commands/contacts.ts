import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { log } from "../../utils/logger.js";
import { contactsStore } from "../stores.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function printContactRow(contact: any): void {
  const id = chalk.gray(contact.id.slice(0, 8));
  const name = chalk.white(contact.name.padEnd(22));
  const email = chalk.cyan(contact.email.padEnd(30));
  const company = chalk.gray((contact.company || "").padEnd(18));
  const tags = contact.tags?.length > 0 ? chalk.yellow(contact.tags.join(", ")) : "";
  console.log(`  ${id}  ${name}  ${email}  ${company}  ${tags}`);
}

function printContactDetail(contact: any): void {
  console.log();
  console.log(chalk.bold("Name:      ") + contact.name);
  console.log(chalk.bold("Email:     ") + contact.email);
  if (contact.phone) console.log(chalk.bold("Phone:     ") + contact.phone);
  if (contact.company) console.log(chalk.bold("Company:   ") + contact.company);
  if (contact.tags?.length > 0) console.log(chalk.bold("Tags:      ") + contact.tags.join(", "));
  if (contact.notes) console.log(chalk.bold("Notes:     ") + contact.notes);
  if (contact.lastContacted) console.log(chalk.bold("Last seen: ") + formatDate(contact.lastContacted));
  console.log(chalk.bold("Created:   ") + formatDate(contact.createdAt));
  console.log();
}

export const contactsCommand = new Command("contacts")
  .description("Manage your contacts")
  .action(async () => {
    const store = await contactsStore();
    const contacts = store.getAllContacts();

    if (contacts.length === 0) {
      log.info("No contacts found.");
      return;
    }

    console.log();
    console.log(chalk.bold(`  Contacts (${contacts.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const contact of contacts) {
      printContactRow(contact);
    }
    console.log();
  });

contactsCommand
  .command("search <query>")
  .description("Search contacts by name, email, company, or tag")
  .action(async (query: string) => {
    const store = await contactsStore();
    const results = store.searchContacts(query);

    if (results.length === 0) {
      log.info(`No contacts matching "${query}".`);
      return;
    }

    console.log();
    console.log(chalk.bold(`  Search results for "${query}" (${results.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const contact of results) {
      printContactRow(contact);
    }
    console.log();
  });

contactsCommand
  .command("add")
  .description("Add a new contact interactively")
  .action(async () => {
    const store = await contactsStore();
    const answers = await inquirer.prompt([
      { type: "input", name: "name", message: "Name:", validate: (v: string) => v.length > 0 || "Name is required" },
      { type: "input", name: "email", message: "Email:", validate: (v: string) => v.includes("@") || "Enter a valid email" },
      { type: "input", name: "phone", message: "Phone (optional):" },
      { type: "input", name: "company", message: "Company (optional):" },
      { type: "input", name: "tags", message: "Tags (comma-separated, optional):" },
      { type: "input", name: "notes", message: "Notes (optional):" },
    ]);

    const contact = store.addContact({
      name: answers.name,
      email: answers.email,
      phone: answers.phone || undefined,
      company: answers.company || undefined,
      tags: answers.tags ? answers.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      notes: answers.notes || undefined,
    });

    log.success(`Contact added: ${contact.name} (${contact.id.slice(0, 8)})`);
  });

contactsCommand
  .command("show <id>")
  .description("Show contact details by ID (prefix match)")
  .action(async (id: string) => {
    const store = await contactsStore();
    const all = store.getAllContacts();
    const match = all.find((c: any) => c.id.startsWith(id));
    if (!match) {
      log.error(`Contact not found: ${id}`);
      return;
    }
    printContactDetail(match);
  });
