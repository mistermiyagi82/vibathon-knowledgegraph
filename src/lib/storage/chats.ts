import fs from "fs";
import path from "path";
import type { Chat, Message, MessageContext } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

function chatDir(chatId: string) {
  return path.join(DATA_PATH, "chats", chatId);
}

export function listChats(): Chat[] {
  const dir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .map((id) => {
      const metaPath = path.join(dir, id, "meta.json");
      if (!fs.existsSync(metaPath)) return null;
      return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Chat;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime()) as Chat[];
}

export function createChat(id: string, title = "New Chat"): Chat {
  const dir = chatDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const chat: Chat = {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(chat, null, 2));
  fs.writeFileSync(path.join(dir, "messages.md"), "");
  return chat;
}

export function updateChatMeta(chatId: string, updates: Partial<Chat>): void {
  const metaPath = path.join(chatDir(chatId), "meta.json");
  const existing = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Chat;
  fs.writeFileSync(metaPath, JSON.stringify({ ...existing, ...updates }, null, 2));
}

export function appendMessage(
  chatId: string,
  userMessage: Message,
  assistantMessage: Message,
  context: MessageContext
): void {
  const filePath = path.join(chatDir(chatId), "messages.md");
  const entry = `
## ${userMessage.timestamp}
**User:** ${userMessage.content}
${userMessage.attachments?.map((f) => `[file: ${f.filename}](../../uploads/${chatId}/${f.filename})`).join("\n") ?? ""}

**Claude:** ${assistantMessage.content}
[context: ${JSON.stringify(context)}]
`;
  fs.appendFileSync(filePath, entry);
}
