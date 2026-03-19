import { parseMessages } from "@/lib/storage/chats";
import type { Message } from "@/types";

// Return the last N messages from a chat's messages.md
export function getRecentMessages(chatId: string, limit = 10): Message[] {
  const messages = parseMessages(chatId);
  return messages.slice(-limit);
}

// Format recent messages as a readable string for the prompt
export function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) return "";
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Claude"}: ${m.content}`)
    .join("\n\n");
}
