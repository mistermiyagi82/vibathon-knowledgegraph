import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { anthropic, MEMORY_TOOLS } from "@/lib/anthropic";
import { getSystemPrompt } from "@/lib/prompt";
import { queryGraphMemory } from "@/lib/memory/graph";
import { semanticSearch } from "@/lib/memory/semantic";
import { getRecentMessages, getMessages, formatRecentMessages } from "@/lib/memory/recent";
import { appendMessage, updateChatMeta, getChatMeta } from "@/lib/storage/chats";
import { listChatFiles, readFileContents } from "@/lib/storage/files";
import { processConversation } from "@/lib/memory/processor";
import { embedText } from "@/lib/memory/embed";
import { indexChunk } from "@/lib/memory/vectordb";
import { getAttioContact, formatContactContext } from "@/lib/attio";
import { getCalendarAvailability, formatAvailability } from "@/lib/calendar";
import fs from "fs";
import path from "path";
import type { Message, MessageContext } from "@/types";

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
}
function getGroqClient() {
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY ?? "", baseURL: "https://api.groq.com/openai/v1" });
}

const GROQ_MODELS = new Set(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b", "moonshotai/kimi-k2-instruct", "groq/compound", "groq/compound-mini"]);
const isOpenAIModel = (m: string) => m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
const isGroqModel = (m: string) => GROQ_MODELS.has(m);

function getThinkingLabel(toolName: string): string {
  switch (toolName) {
    case "query_memory": return "Checking memory...";
    case "search_history": return "Looking through past conversations...";
    case "get_recent_messages": return "Reading recent messages...";
    case "get_chat_history": return "Looking through conversation history...";
    case "get_attio_contact": return "Looking up candidate profile...";
    case "get_calendar_availability": return "Checking calendar availability...";
    default: return "Thinking...";
  }
}

async function executeTool(
  name: string,
  input: Record<string, string>,
  chatId: string
): Promise<{ result: string; partialContext: Partial<MessageContext> }> {
  if (name === "query_memory") {
    const facts = await queryGraphMemory(input.question ?? "", chatId);
    return {
      result:
        facts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n") ||
        "No relevant facts found.",
      partialContext: { graph: facts },
    };
  }
  if (name === "search_history") {
    const excerpts = await semanticSearch(input.query ?? "", chatId);
    return {
      result:
        excerpts.map((e) => `[${e.chatTitle}] ${e.excerpt}`).join("\n\n") ||
        "No relevant history found.",
      partialContext: { history: excerpts },
    };
  }
  if (name === "get_recent_messages") {
    const recent = getRecentMessages(chatId, 10);
    return {
      result: formatRecentMessages(recent) || "No recent messages.",
      partialContext: { recent: recent.length > 0 },
    };
  }
  if (name === "get_chat_history") {
    const offset = typeof input.offset === "string" ? parseInt(input.offset) : (input.offset as unknown as number ?? 0);
    const limit = typeof input.limit === "string" ? parseInt(input.limit) : (input.limit as unknown as number ?? 10);
    const msgs = getMessages(chatId, offset, limit);
    return {
      result: formatRecentMessages(msgs) || "No messages found at that position.",
      partialContext: {},
    };
  }
  if (name === "get_attio_contact") {
    const contactId = input.contact_id;
    if (!contactId) return { result: "No contact_id provided.", partialContext: {} };
    const contact = await getAttioContact(contactId);
    if (!contact) return { result: "Contact not found in Attio.", partialContext: {} };
    return {
      result: formatContactContext(contact),
      partialContext: {},
    };
  }
  if (name === "get_calendar_availability") {
    const person = input.person as "daniel" | "daisy";
    const result = await getCalendarAvailability(person, input.date_from, input.date_to);
    return {
      result: formatAvailability(person, result),
      partialContext: {},
    };
  }
  return { result: "Unknown tool.", partialContext: {} };
}

async function runOpenAICompatibleStream(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  initialContent: string,
  chatId: string,
  context: MessageContext,
  perf: { step: string; ms: number }[],
  emit: (payload: object) => void,
  t: () => number
): Promise<string> {
  const oaiTools: OpenAI.Chat.ChatCompletionTool[] = MEMORY_TOOLS.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
  }));

  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: initialContent },
  ];

  let fullResponse = "";
  let toolsSupported = true;

  for (let i = 0; i < 5; i++) {
    const start = t();
    let firstToken = true;
    let finishReason: string | null = null;
    const toolCallAccumulator: Record<string, { name: string; args: string }> = {};

    let oaiStream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
    try {
      oaiStream = await client.chat.completions.create({ model, stream: true, ...(toolsSupported ? { tools: oaiTools } : {}), messages: msgs });
    } catch (err: unknown) {
      if (toolsSupported && typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 400) {
        toolsSupported = false;
        oaiStream = await client.chat.completions.create({ model, stream: true, messages: msgs });
      } else { throw err; }
    }

    for await (const chunk of oaiStream) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAccumulator[tc.index]) {
            toolCallAccumulator[tc.index] = { name: tc.function?.name ?? "", args: "" };
            emit({ thinking: getThinkingLabel(tc.function?.name ?? "") });
          }
          toolCallAccumulator[tc.index].args += tc.function?.arguments ?? "";
        }
      }

      if (delta?.content) {
        if (firstToken) {
          perf.push({ step: i === 0 ? "Time to first token" : "Time to first token (after tools)", ms: t() - start });
          firstToken = false;
        }
        fullResponse += delta.content;
        emit({ text: delta.content });
      }
    }

    if (firstToken && Object.keys(toolCallAccumulator).length === 0) {
      perf.push({ step: `API call ${i + 1}`, ms: t() - start });
    }

    if (!toolsSupported || finishReason !== "tool_calls" || Object.keys(toolCallAccumulator).length === 0) break;

    const toolCalls = Object.entries(toolCallAccumulator).map(([index, tc]) => ({
      id: `call_${index}`, type: "function" as const, function: { name: tc.name, arguments: tc.args },
    }));

    msgs.push({ role: "assistant", tool_calls: toolCalls, content: null });

    const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
    for (const tc of toolCalls) {
      let input: Record<string, string> = {};
      try { input = JSON.parse(tc.function.arguments); } catch { /* skip */ }
      const toolStart = t();
      const { result, partialContext } = await executeTool(tc.function.name, input, chatId);
      perf.push({ step: tc.function.name, ms: t() - toolStart });
      if (partialContext.graph) context.graph.push(...partialContext.graph);
      if (partialContext.history) context.history.push(...partialContext.history);
      if (partialContext.recent) context.recent = true;
      toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
    msgs.push(...toolResults);
  }

  return fullResponse;
}

// POST /api/chats/:chatId/messages — send a message and stream Claude's response
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { message: userText, model = "claude-sonnet-4-6" } = await req.json();

  const messageId = uuid();
  const userId = uuid();

  if (userText.trim().toLowerCase() === "/memory") {
    return handleMemoryCommand(chatId, messageId, userId);
  }

  const isFirstMessage = getRecentMessages(chatId, 1).length === 0;
  const encoder = new TextEncoder();
  let fullResponse = "";

  // Load chat meta for per-chat config and contact injection
  const chatMeta = getChatMeta(chatId);
  const systemPrompt = getSystemPrompt(chatId);

  // Read uploaded files for this chat and inject contents
  const chatFiles = listChatFiles(chatId);
  const fileBlocks = chatFiles
    .map((f) => {
      const contents = readFileContents(chatId, f.filename);
      return contents ? `File: ${f.filename}\n\`\`\`\n${contents}\n\`\`\`` : null;
    })
    .filter((b): b is string => b !== null);

  // Auto-inject Attio contact context on first message if chat has a contactId
  let contactContextBlock = "";
  if (isFirstMessage && chatMeta?.contactId) {
    try {
      const contact = await getAttioContact(chatMeta.contactId);
      if (contact) {
        contactContextBlock = `\n\n[Candidate Profile from Attio]\n${formatContactContext(contact)}`;
      }
    } catch { /* non-critical */ }
  }

  const initialContent =
    [
      userText,
      fileBlocks.length > 0 ? `\n\n[Files in this conversation]\n${fileBlocks.join("\n\n")}` : "",
      contactContextBlock,
    ]
      .filter(Boolean)
      .join("");

  const context: MessageContext = { graph: [], history: [], files: chatFiles, recent: false };

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      const perf: { step: string; ms: number }[] = [];
      const t = () => Date.now();

      try {
        if (isOpenAIModel(model)) {
          fullResponse = await runOpenAICompatibleStream(getOpenAIClient(), model, systemPrompt, initialContent, chatId, context, perf, emit, t);
        } else if (isGroqModel(model)) {
          fullResponse = await runOpenAICompatibleStream(getGroqClient(), model, systemPrompt, initialContent, chatId, context, perf, emit, t);
        } else {
          // Anthropic Claude path
          const msgs: Anthropic.MessageParam[] = [{ role: "user", content: initialContent }];

          for (let i = 0; i < 5; i++) {
            const claudeStart = t();
            let firstToken = true;

            const claudeStream = anthropic.messages.stream({
              model,
              max_tokens: 4096,
              system: systemPrompt,
              tools: MEMORY_TOOLS,
              messages: msgs,
            });

            for await (const chunk of claudeStream) {
              if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
                emit({ thinking: getThinkingLabel(chunk.content_block.name) });
              }
              if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                if (firstToken) {
                  perf.push({ step: i === 0 ? "Time to first token" : "Time to first token (after tools)", ms: t() - claudeStart });
                  firstToken = false;
                }
                fullResponse += chunk.delta.text;
                emit({ text: chunk.delta.text });
              }
            }

            const finalMessage = await claudeStream.finalMessage();
            if (firstToken) {
              perf.push({ step: `Claude API call ${i + 1}`, ms: t() - claudeStart });
            }
            if (finalMessage.stop_reason !== "tool_use") break;

            msgs.push({ role: "assistant", content: finalMessage.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of finalMessage.content) {
              if (block.type !== "tool_use") continue;
              const toolStart = t();
              const { result, partialContext } = await executeTool(
                block.name,
                block.input as Record<string, string>,
                chatId
              );
              perf.push({ step: block.name, ms: t() - toolStart });
              if (partialContext.graph) context.graph.push(...partialContext.graph);
              if (partialContext.history) context.history.push(...partialContext.history);
              if (partialContext.recent) context.recent = true;
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }

            msgs.push({ role: "user", content: toolResults });
          }
        }

        const now = new Date().toISOString();
        const userMessage: Message = { id: userId, role: "user", content: userText, timestamp: now };
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: fullResponse,
          timestamp: now,
          model,
        };

        await Promise.all([
          appendMessage(chatId, userMessage, assistantMessage, context, perf),
          processConversation(chatId, userText, fullResponse).catch(() => {}),
          indexExchange(chatId, userText, fullResponse, now).catch(() => {}),
        ]);

        let title: string | undefined;
        if (isFirstMessage) {
          // Use contact name as title if this is a recruiter chat, otherwise auto-generate
          if (chatMeta?.contactName) {
            title = chatMeta.contactName;
          } else {
            title = await generateTitle(userText);
          }
          updateChatMeta(chatId, { title, updatedAt: now });
        } else {
          updateChatMeta(chatId, { updatedAt: now });
        }

        emit({ done: true, messageId, userMessageId: userId, context, title, perf });
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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

async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      messages: [
        {
          role: "user",
          content: `Summarize this message as a chat title in 4-5 words. Return only the title, no quotes or punctuation.\n\n"${firstMessage}"`,
        },
      ],
    });
    const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    return text || "New Chat";
  } catch {
    return "New Chat";
  }
}

async function handleMemoryCommand(chatId: string, messageId: string, userId: string) {
  const encoder = new TextEncoder();
  let fullResponse = "";

  const graphFacts = await queryGraphMemory("", chatId);
  const graphSummary = graphFacts
    .map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`)
    .join("\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: getSystemPrompt(chatId),
          messages: [
            {
              role: "user",
              content: `Based on your memory graph below, give a natural language summary of everything you know about me and our conversations. Be warm and specific.\n\nGraph:\n${graphSummary || "(no memory yet)"}`,
            },
          ],
        });

        for await (const chunk of claudeStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullResponse += chunk.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
          }
        }

        const now = new Date().toISOString();
        const userMessage: Message = { id: userId, role: "user", content: "/memory", timestamp: now };
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: fullResponse,
          timestamp: now,
        };
        const context: MessageContext = { graph: graphFacts, history: [], files: [], recent: false };

        await appendMessage(chatId, userMessage, assistantMessage, context);
        updateChatMeta(chatId, { updatedAt: now });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, messageId, userMessageId: userId, context })}\n\n`
          )
        );
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
