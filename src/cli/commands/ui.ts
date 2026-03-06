import { Command } from "commander";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../../utils/logger.js";
import { hasAnthropicKey, loginFlow } from "../auth.js";
import { getCommsHome, getDataDir } from "../../config/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uiCommand = new Command("ui")
  .description("Launch the Comms Client web UI")
  .option("-p, --port <port>", "Port to run on", "3000")
  .action(async (opts) => {
    // Check for API key before launching
    if (!hasAnthropicKey()) {
      log.warn("No Anthropic API key found. You need to authenticate first.");
      const success = await loginFlow();
      if (!success) {
        log.error("Cannot launch UI without authentication.");
        process.exit(1);
      }
    }

    const uiDir = path.resolve(__dirname, "../../../ui");

    // Set environment variables for the UI process
    const env = {
      ...process.env,
      COMMS_HOME: getCommsHome(),
      COMMS_DATA_DIR: getDataDir(),
    };

    log.info(`Starting UI on port ${opts.port}...`);

    const child = spawn("npm", ["run", "dev", "--", "-p", opts.port], {
      cwd: uiDir,
      stdio: "inherit",
      shell: true,
      env,
    });

    child.on("error", (err) => {
      log.error(`Failed to start UI: ${err.message}`);
    });
  });
