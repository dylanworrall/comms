import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatThread {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = process.env.COMMS_DATA_DIR ?? join(homedir(), ".comms", "data");
const THREADS_PATH = join(DATA_DIR, "chat-threads.json");
const MESSAGES_PATH = join(DATA_DIR, "chat-messages.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// --- Threads ---

function getAllThreads(): ChatThread[] {
  try {
    const raw = readFileSync(THREADS_PATH, "utf-8");
    return JSON.parse(raw) as ChatThread[];
  } catch {
    return [];
  }
}

function saveAllThreads(items: ChatThread[]): void {
  ensureDir();
  writeFileSync(THREADS_PATH, JSON.stringify(items, null, 2), "utf-8");
}

// --- Messages ---

function getAllMessages(): ChatMessage[] {
  try {
    const raw = readFileSync(MESSAGES_PATH, "utf-8");
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveAllMessages(items: ChatMessage[]): void {
  ensureDir();
  writeFileSync(MESSAGES_PATH, JSON.stringify(items, null, 2), "utf-8");
}

// --- Public API ---

export function getThreads(): ChatThread[] {
  const threads = getAllThreads();
  // Sort newest first by updatedAt
  return threads.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getThread(threadId: string): ChatThread | null {
  return getAllThreads().find((t) => t.id === threadId) ?? null;
}

export function getMessages(threadId: string): ChatMessage[] {
  return getAllMessages()
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function addMessage(
  threadId: string,
  role: ChatMessage["role"],
  content: string
): ChatMessage {
  const messages = getAllMessages();
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    threadId,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
  messages.push(message);
  saveAllMessages(messages);

  // Update thread's lastMessage and updatedAt
  const threads = getAllThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    thread.lastMessage = content.slice(0, 120);
    thread.updatedAt = message.timestamp;
    saveAllThreads(threads);
  }

  return message;
}

export function createThread(title: string): ChatThread {
  const threads = getAllThreads();
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: crypto.randomUUID(),
    title,
    lastMessage: "",
    createdAt: now,
    updatedAt: now,
  };
  threads.push(thread);
  saveAllThreads(threads);
  return thread;
}

export function updateThreadTitle(threadId: string, title: string): ChatThread | null {
  const threads = getAllThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.title = title;
  thread.updatedAt = new Date().toISOString();
  saveAllThreads(threads);
  return thread;
}
