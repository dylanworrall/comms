import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../../utils/logger.js";
import { voiceAgentStore } from "../stores.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const voiceCommand = new Command("voice")
  .description("Voice agent management");

voiceCommand
  .command("agents")
  .description("List all voice agents")
  .action(async () => {
    const store = await voiceAgentStore();
    const agents = store.getAllAgents();
    const defaultAgent = store.getDefaultAgent();

    if (agents.length === 0) {
      log.info("No voice agents configured.");
      return;
    }

    console.log();
    console.log(chalk.bold(`  Voice Agents (${agents.length})`));
    console.log(chalk.gray("  " + "\u2500".repeat(70)));
    for (const agent of agents) {
      const isDefault = agent.id === defaultAgent.id;
      const marker = isDefault ? chalk.green("\u2713") : " ";
      const id = chalk.gray(agent.id.slice(0, 8));
      const name = chalk.white(agent.agentName.padEnd(14));
      const engine = chalk.yellow((agent.voiceEngine || "gemini").padEnd(8));
      const voice = chalk.gray(agent.voice.padEnd(14));
      const template = chalk.cyan(agent.activeTemplate.padEnd(18));
      const phone = agent.phoneNumber ? chalk.magenta(agent.phoneNumber) : chalk.gray("no number");
      console.log(`  ${marker} ${id}  ${name}  ${engine}  ${voice}  ${template}  ${phone}`);
    }
    console.log();
    console.log(chalk.gray("  \u2713 = default agent"));
    console.log();
  });

voiceCommand
  .command("show <id>")
  .description("Show voice agent details by ID (prefix match)")
  .action(async (id: string) => {
    const store = await voiceAgentStore();
    const agents = store.getAllAgents();
    const match = agents.find((a: any) => a.id.startsWith(id));
    if (!match) {
      log.error(`Agent not found: ${id}`);
      return;
    }
    console.log();
    console.log(chalk.bold("Agent:       ") + match.agentName);
    console.log(chalk.bold("Company:     ") + match.companyName);
    console.log(chalk.bold("Template:    ") + match.activeTemplate);
    console.log(chalk.bold("Engine:      ") + (match.voiceEngine || "gemini"));
    console.log(chalk.bold("Voice:       ") + match.voice);
    console.log(chalk.bold("Phone:       ") + (match.phoneNumber || chalk.gray("not assigned")));
    console.log(chalk.bold("Callback:    ") + (match.callbackNumber || chalk.gray("not set")));
    console.log(chalk.bold("Transfer:    ") + (match.transferNumber || chalk.gray("not set")));
    console.log(chalk.bold("Max tries:   ") + match.maxAttempts);
    console.log(chalk.bold("Tools:       ") + (match.enableTools ? chalk.green("enabled") : chalk.gray("disabled")));
    const w = match.callWindows;
    console.log(chalk.bold("Call window: ") + `${w.startHour}:00-${w.endHour}:00, days ${w.daysOfWeek.join(",")}, ${w.timezone}`);
    console.log();
  });

voiceCommand
  .command("start")
  .description("Start the voice server")
  .action(async () => {
    const store = await voiceAgentStore();
    const uiDir = path.resolve(__dirname, "../../../../ui");
    const agent = store.getDefaultAgent();

    log.info(`Starting voice server — agent "${agent.agentName}" (${agent.voiceEngine || "gemini"})...`);

    const child = spawn("npx", ["tsx", "voice-server.ts"], {
      cwd: uiDir,
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    });

    child.on("error", (err) => {
      log.error(`Failed to start voice server: ${err.message}`);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        log.warn(`Voice server exited with code ${code}`);
      }
    });
  });
