import path from "node:path";
import { homedir } from "node:os";

export function getCommsHome(): string {
  return process.env.COMMS_HOME ?? path.join(homedir(), ".comms");
}

export function getHomeDir(): string {
  return getCommsHome();
}

export function getConfigPath(): string {
  return path.join(getCommsHome(), "config.json");
}

export function getDataDir(): string {
  return path.join(getCommsHome(), "data");
}

export function getEnvPath(): string {
  return path.join(getCommsHome(), ".env");
}
