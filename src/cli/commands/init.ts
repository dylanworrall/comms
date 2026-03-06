import { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { getHomeDir, getConfigPath, getEnvPath, getDataDir } from "../../config/paths.js";
import { log } from "../../utils/logger.js";
import { loginFlow, resendSetupFlow, hasAnthropicKey } from "../auth.js";

export const initCommand = new Command("init")
  .description("Initialize Comms Client configuration")
  .action(async () => {
    const homeDir = getHomeDir();

    if (!existsSync(homeDir)) {
      mkdirSync(homeDir, { recursive: true });
      log.success(`Created ${homeDir}`);
    }

    // Create data directory
    const dataDir = getDataDir();
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      log.success(`Created ${dataDir}`);
    }

    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      writeFileSync(configPath, JSON.stringify({
        anthropicModel: "claude-sonnet-4-20250514",
        fromEmail: "you@example.com",
        agentModes: {
          send_email: "draft",
        },
      }, null, 2));
      log.success(`Created ${configPath}`);
    } else {
      log.info(`Config already exists at ${configPath}`);
    }

    // Ensure .env file exists
    const envPath = getEnvPath();
    if (!existsSync(envPath)) {
      writeFileSync(envPath, "");
      log.success(`Created ${envPath}`);
    }

    // Anthropic API key setup
    if (!hasAnthropicKey()) {
      log.info("No Anthropic API key found. Let's set one up.");
      await loginFlow();
    } else {
      log.success("Anthropic API key already configured");
    }

    // Resend setup
    await resendSetupFlow();

    log.success("Comms Client initialized!");
  });
