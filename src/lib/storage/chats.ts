import fs from "fs";
import path from "path";
import type { Chat, Message, MessageContext, PerfEntry, TokenUsage, AgentConfig } from "@/types";

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
    .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()) as Chat[];
}

interface CreateChatOptions {
  title?: string;
  contactId?: string;
  contactName?: string;
  templateId?: string;
  agentConfig?: AgentConfig;
}

export function createChat(id: string, options: string | CreateChatOptions = {}): Chat {
  const dir = chatDir(id);
  fs.mkdirSync(dir, { recursive: true });

  // Support old string signature for backwards compat
  const opts: CreateChatOptions =
    typeof options === "string" ? { title: options } : options;

  const title = opts.contactName || opts.title || "New Chat";

  const chat: Chat = {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    ...(opts.contactId ? { contactId: opts.contactId } : {}),
    ...(opts.contactName ? { contactName: opts.contactName } : {}),
    ...(opts.templateId ? { templateId: opts.templateId } : {}),
    ...(opts.agentConfig ? { agentConfig: opts.agentConfig } : {}),
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(chat, null, 2));
  fs.writeFileSync(path.join(dir, "messages.md"), "");
  return chat;
}

export function getChatMeta(chatId: string): Chat | null {
  const metaPath = path.join(chatDir(chatId), "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Chat;
  } catch {
    return null;
  }
}

export function updateChatMeta(chatId: string, updates: Partial<Chat>): void {
  const metaPath = path.join(chatDir(chatId), "meta.json");
  if (!fs.existsSync(metaPath)) return;
  const existing = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Chat;
  fs.writeFileSync(metaPath, JSON.stringify({ ...existing, ...updates }, null, 2));
}

export function appendMessage(
  chatId: string,
  userMessage: Message,
  assistantMessage: Message,
  context: MessageContext,
  perf?: PerfEntry[],
  usage?: TokenUsage
): void {
  const dir = chatDir(chatId);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, "messages.md"))) {
    fs.writeFileSync(path.join(dir, "messages.md"), "");
  }
  const filePath = path.join(dir, "messages.md");
  const attachmentLines = userMessage.attachments
    ?.map((f) => `[file: ${f.filename}](../../uploads/${chatId}/${f.filename})`)
    .join("\n") ?? "";

  const entry = `\n## ${userMessage.timestamp}
<!-- user-id: ${userMessage.id} -->
**User:** ${userMessage.content}
${attachmentLines}
<!-- assistant-id: ${assistantMessage.id} -->
**Claude:** ${assistantMessage.content}
<!-- context: ${JSON.stringify(context)} -->
${assistantMessage.model ? `<!-- model: ${assistantMessage.model} -->` : ""}
${perf && perf.length > 0 ? `<!-- perf: ${JSON.stringify(perf)} -->` : ""}
${usage ? `<!-- usage: ${JSON.stringify(usage)} -->` : ""}

`;
  fs.appendFileSync(filePath, entry);

  // Update meta
  const metaPath = path.join(chatDir(chatId), "meta.json");
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Chat;
    const preview = userMessage.content.slice(0, 80);
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          ...meta,
          updatedAt: assistantMessage.timestamp,
          messageCount: meta.messageCount + 2,
          lastMessagePreview: preview,
        },
        null,
        2
      )
    );
  }
}

// Parse a messages.md file into an array of Message objects
export function parseMessages(chatId: string): Message[] {
  const filePath = path.join(chatDir(chatId), "messages.md");
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const messages: Message[] = [];

  // Split into exchange blocks on ## timestamp headings
  const blocks = content.split(/\n(?=## \d{4}-\d{2}-\d{2}T)/).filter((b) => b.trim());

  for (const block of blocks) {
    const timestampMatch = block.match(/^## (\S+)/);
    if (!timestampMatch) continue;
    const timestamp = timestampMatch[1];

    // Extract user id and content
    const userIdMatch = block.match(/<!-- user-id: ([^\s]+) -->/);
    const userId = userIdMatch?.[1] ?? "";

    const userContentMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=<!-- assistant-id:|$)/);
    const userContent = userContentMatch?.[1]?.trim() ?? "";
    // Strip any file attachment lines from user content
    const cleanUserContent = userContent.replace(/\[file:[^\]]+\]\([^)]+\)/g, "").trim();

    // Extract assistant id and content
    const assistantIdMatch = block.match(/<!-- assistant-id: ([^\s]+) -->/);
    const assistantId = assistantIdMatch?.[1] ?? "";

    const assistantContentMatch = block.match(/\*\*Claude:\*\* ([\s\S]*?)(?=<!-- context:|$)/);
    const assistantContent = assistantContentMatch?.[1]?.trim() ?? "";

    if (cleanUserContent) {
      messages.push({
        id: userId || `user-${timestamp}`,
        role: "user",
        content: cleanUserContent,
        timestamp,
      });
    }

    if (assistantContent) {
      const perfMatch = block.match(/<!-- perf: (\[[\s\S]*?\]) -->/);
      const modelMatch = block.match(/<!-- model: ([^\s]+) -->/);
      const usageMatch = block.match(/<!-- usage: (\{[\s\S]*?\}) -->/);
      let perf: PerfEntry[] | undefined;
      let usage: TokenUsage | undefined;
      try { if (perfMatch) perf = JSON.parse(perfMatch[1]); } catch { /* skip */ }
      try { if (usageMatch) usage = JSON.parse(usageMatch[1]); } catch { /* skip */ }
      messages.push({
        id: assistantId || `assistant-${timestamp}`,
        role: "assistant",
        content: assistantContent,
        timestamp,
        perf,
        model: modelMatch?.[1],
        usage,
      });
    }
  }

  return messages;
}

// Look up context for a given assistant messageId
export function findContextForMessage(messageId: string): MessageContext | null {
  const chatsDir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(chatsDir)) return null;

  for (const chatId of fs.readdirSync(chatsDir)) {
    const filePath = path.join(chatsDir, chatId, "messages.md");
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.includes(`<!-- assistant-id: ${messageId} -->`)) continue;

    // Find the context comment that follows this assistant id
    const pattern = new RegExp(
      `<!-- assistant-id: ${messageId} -->[\\s\\S]*?<!-- context: (\\{[\\s\\S]*?\\}) -->`
    );
    const match = content.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1]) as MessageContext;
      } catch {
        return null;
      }
    }
  }

  return null;
}
