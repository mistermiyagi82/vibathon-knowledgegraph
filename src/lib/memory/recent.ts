import fs from "fs";
import path from "path";
import type { Message } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

// Return the last N messages from a chat's messages.md
export function getRecentMessages(chatId: string, limit = 10): Message[] {
  const filePath = path.join(DATA_PATH, "chats", chatId, "messages.md");
  if (!fs.existsSync(filePath)) return [];

  // TODO: parse the MD format into Message objects
  // For now return empty — parsing logic goes here
  return [];
}
