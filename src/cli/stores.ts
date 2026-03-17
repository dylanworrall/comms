/**
 * Bridge to import UI stores from the CLI.
 * Uses path.resolve to get absolute paths, avoiding module resolution issues.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storesDir = path.resolve(__dirname, "../../ui/src/lib/stores");

// Cache loaded modules
const cache: Record<string, unknown> = {};

async function loadStore(name: string): Promise<any> {
  if (cache[name]) return cache[name];
  const fullPath = path.join(storesDir, name);
  const mod = await import(pathToFileURL(fullPath).href);
  cache[name] = mod;
  return mod;
}

export async function inboxStore() {
  return loadStore("inbox-store.ts");
}

export async function contactsStore() {
  return loadStore("contacts.ts");
}

export async function callsStore() {
  return loadStore("calls-store.ts");
}

export async function voiceAgentStore() {
  return loadStore("voice-agent-store.ts");
}

export async function approvalsStore() {
  return loadStore("approvals.ts");
}

export async function activityStore() {
  return loadStore("activity.ts");
}
