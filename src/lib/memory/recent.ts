import { parseMessages } from "@/lib/storage/chats";
import type { Message } from "@/types";

// Return the last N messages from a chat's messages.md
export function getRecentMessages(chatId: string, limit = 10): Message[] {
  const messages = parseMessages(chatId);
  return messages.slice(-limit);
}

// Return messages from any position in the chat.
// offset=0 starts from the beginning; negative offset counts from the end.
export function getMessages(chatId: string, offset = 0, limit = 10): Message[] {
  const messages = parseMessages(chatId);
  const start = offset < 0 ? Math.max(0, messages.length + offset) : offset;
  return messages.slice(start, start + limit);
}

// Format recent messages as a readable string for the prompt
export function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) return "";
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Claude"}: ${m.content}`)
    .join("\n\n");
}

// Keyword search across all messages in a chat — exact case-insensitive match
export function grepHistory(chatId: string, keyword: string, limit = 10): Message[] {
  const messages = parseMessages(chatId);
  const lower = keyword.toLowerCase();
  return messages
    .filter((m) => m.content.toLowerCase().includes(lower))
    .slice(-limit);
}
