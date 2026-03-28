import { streamText, convertToCoreMessages, generateText, experimental_createMCPClient } from "ai";
import { anthropic as anthropicProvider } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { v4 as uuid } from "uuid";
import { getChatMeta, updateChatMeta, appendMessage } from "@/lib/storage/chats";
import { getSystemPrompt } from "@/lib/prompt";
import { getAttioContact, formatContactContext } from "@/lib/attio";
import { listChatFiles, readFileContents } from "@/lib/storage/files";
import { processConversation } from "@/lib/memory/processor";
import { embedText } from "@/lib/memory/embed";
import { indexChunk } from "@/lib/memory/vectordb";
import { graphitiHealthy, graphitiIngestEpisode } from "@/lib/graphiti";
import { calculateCost } from "@/lib/pricing";
import { getRecentMessages } from "@/lib/memory/recent";
import { queryGraphMemory } from "@/lib/memory/graph";
import { buildMemoryTools } from "@/lib/tools";
import fs from "fs";
import path from "path";
import type { Message, MessageContext } from "@/types";

const GROQ_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "moonshotai/kimi-k2-instruct",
  "groq/compound",
  "groq/compound-mini",
]);
const isOpenAIModel = (m: string) =>
  m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
const isGroqModel = (m: string) => GROQ_MODELS.has(m);

export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { messages, model = "claude-sonnet-4-6" } = await req.json();

  // Extract last user message text
  const lastMsg = messages?.[messages.length - 1];
  const userText =
    typeof lastMsg?.content === "string"
      ? lastMsg.content
      : Array.isArray(lastMsg?.content)
      ? (lastMsg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("")
      : "";

  // Handle /memory command
  if (userText.trim().toLowerCase() === "/memory") {
    return handleMemoryCommand(chatId, userText);
  }

  const isFirstMessage = getRecentMessages(chatId, 1).length === 0;
  const chatMeta = getChatMeta(chatId);
  let systemPrompt = getSystemPrompt(chatId);

  // Inject Attio contact
  if (chatMeta?.contactId) {
    try {
      let contact = chatMeta.cachedContact ?? null;
      if (!contact) {
        contact = await getAttioContact(chatMeta.contactId);
        if (contact) updateChatMeta(chatId, { cachedContact: contact });
      }
      if (contact) {
        systemPrompt += `\n\n---\n\n[Candidate Profile — always available, no need to fetch]\n${formatContactContext(contact)}`;
      }
    } catch { /* non-critical */ }
  }

  // Build core messages, injecting uploaded file contents into the last user message
  const coreMessages = convertToCoreMessages(messages);
  const chatFiles = listChatFiles(chatId);
  const fileBlocks = chatFiles
    .map((f) => {
      const contents = readFileContents(chatId, f.filename);
      return contents ? `File: ${f.filename}\n\`\`\`\n${contents}\n\`\`\`` : null;
    })
    .filter((b): b is string => b !== null);

  if (fileBlocks.length > 0 && coreMessages.length > 0) {
    const last = coreMessages[coreMessages.length - 1];
    if (last.role === "user" && typeof last.content === "string") {
      last.content += `\n\n[Files in this conversation]\n${fileBlocks.join("\n\n")}`;
    }
  }

  // Build model provider
  let modelProvider;
  if (isOpenAIModel(model)) {
    modelProvider = openai(model);
  } else if (isGroqModel(model)) {
    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY ?? "",
    });
    modelProvider = groq(model);
  } else {
    modelProvider = anthropicProvider(model);
  }

  // Build tools with shared context for accumulating graph/history results
  const context: MessageContext = { graph: [], history: [], files: chatFiles, recent: false };
  const memoryTools = buildMemoryTools(chatId, context);

  // MCP tools — connect if configured for this chat (5 s timeout so slow servers don't block)
  let mcpTools: Record<string, unknown> = {};
  let mcpClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
  const mcpUrl = chatMeta?.agentConfig?.mcpServer?.url;
  if (mcpUrl) {
    try {
      const deadline = <T>(ms: number, p: Promise<T>): Promise<T> =>
        Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error("MCP timeout")), ms))]);
      mcpClient = await deadline(5000, experimental_createMCPClient({
        transport: { type: "sse", url: mcpUrl },
      }));
      mcpTools = await deadline(5000, mcpClient.tools());
    } catch { /* MCP unavailable or timed out, continue without */ }
  }

  const userId = uuid();
  const messageId = uuid();
  const now = new Date().toISOString();

  const result = streamText({
    model: modelProvider,
    system: systemPrompt,
    messages: coreMessages,
    tools: { ...memoryTools, ...mcpTools },
    maxSteps: 5,
    onFinish: async ({ text, usage }) => {
      try {
        const userMessage: Message = { id: userId, role: "user", content: userText, timestamp: now };
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: text,
          timestamp: now,
          model,
          usage: usage
            ? calculateCost(model, usage.promptTokens, usage.completionTokens, 0, 0)
            : undefined,
        };

        await Promise.all([
          appendMessage(chatId, userMessage, assistantMessage, context, undefined, assistantMessage.usage),
          processConversation(chatId, userText, text).catch(() => {}),
          indexExchange(chatId, userText, text, now).catch(() => {}),
          graphitiHealthy().then((ok) => {
            if (!ok) return;
            return graphitiIngestEpisode(
              chatId,
              `msg-${userId}`,
              `User: ${userText}\nAssistant: ${text}`
            ).catch(() => {});
          }),
        ]);

        if (isFirstMessage) {
          const title = chatMeta?.contactName ?? (await generateTitle(userText));
          updateChatMeta(chatId, { title, updatedAt: now });
        } else {
          updateChatMeta(chatId, { updatedAt: now });
        }
      } finally {
        if (mcpClient) {
          try { await mcpClient.close(); } catch { /* ignore */ }
        }
      }
    },
  });

  return result.toDataStreamResponse();
}

async function handleMemoryCommand(chatId: string, userText: string): Promise<Response> {
  const graphFacts = await queryGraphMemory("", chatId);
  const graphSummary = graphFacts
    .map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`)
    .join("\n");

  const userId = uuid();
  const messageId = uuid();
  const now = new Date().toISOString();

  const result = streamText({
    model: anthropicProvider("claude-sonnet-4-6"),
    system: getSystemPrompt(chatId),
    messages: [
      {
        role: "user",
        content: `Based on your memory graph below, give a natural language summary of everything you know about me and our conversations. Be warm and specific.\n\nGraph:\n${
          graphSummary || "(no memory yet)"
        }`,
      },
    ],
    onFinish: async ({ text }) => {
      const userMessage: Message = { id: userId, role: "user", content: userText, timestamp: now };
      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: text,
        timestamp: now,
      };
      const context: MessageContext = { graph: graphFacts, history: [], files: [], recent: false };
      appendMessage(chatId, userMessage, assistantMessage, context);
      updateChatMeta(chatId, { updatedAt: now });
    },
  });

  return result.toDataStreamResponse();
}

async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: anthropicProvider("claude-haiku-4-5-20251001"),
      maxTokens: 20,
      messages: [
        {
          role: "user",
          content: `Summarize this message as a chat title in 4-5 words. Return only the title, no quotes or punctuation.\n\n"${firstMessage}"`,
        },
      ],
    });
    return text.trim() || "New Chat";
  } catch {
    return "New Chat";
  }
}

async function indexExchange(
  chatId: string,
  userText: string,
  assistantResponse: string,
  timestamp: string
): Promise<void> {
  const excerpt = `User: ${userText.slice(0, 500)}\n\nClaude: ${assistantResponse.slice(0, 500)}`;
  const embedding = await embedText(excerpt);
  if (!embedding) return;

  const DATA_PATH = process.env.DATA_PATH || "./data";
  const metaPath = path.join(DATA_PATH, "chats", chatId, "meta.json");
  let chatTitle: string | null = null;
  try {
    if (fs.existsSync(metaPath)) {
      chatTitle = JSON.parse(fs.readFileSync(metaPath, "utf-8")).title ?? null;
    }
  } catch { /* non-critical */ }

  indexChunk({ chatId, chatTitle, timestamp, excerpt, embedding });
}
