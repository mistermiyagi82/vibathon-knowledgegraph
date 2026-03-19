import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, SYSTEM_PROMPT, MEMORY_TOOLS } from "@/lib/anthropic";
import { queryGraphMemory } from "@/lib/memory/graph";
import { semanticSearch } from "@/lib/memory/semantic";
import { getRecentMessages, getMessages, formatRecentMessages } from "@/lib/memory/recent";
import { appendMessage, updateChatMeta } from "@/lib/storage/chats";
import { listChatFiles, readFileContents } from "@/lib/storage/files";
import { processConversation } from "@/lib/memory/processor";
import { embedText } from "@/lib/memory/embed";
import { indexChunk } from "@/lib/memory/vectordb";
import fs from "fs";
import path from "path";
import type { Message, MessageContext } from "@/types";

function getThinkingLabel(toolName: string): string {
  switch (toolName) {
    case "query_memory": return "Checking memory...";
    case "search_history": return "Looking through past conversations...";
    case "get_recent_messages": return "Reading recent messages...";
    case "get_chat_history": return "Looking through conversation history...";
    default: return "Thinking...";
  }
}

async function executeTool(
  name: string,
  input: Record<string, string>,
  chatId: string
): Promise<{ result: string; partialContext: Partial<MessageContext> }> {
  if (name === "query_memory") {
    const facts = await queryGraphMemory(input.question ?? "");
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
  return { result: "Unknown tool.", partialContext: {} };
}

// POST /api/chats/:chatId/messages — send a message and stream Claude's response
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { message: userText } = await req.json();

  const messageId = uuid();
  const userId = uuid();

  if (userText.trim().toLowerCase() === "/memory") {
    return handleMemoryCommand(chatId, messageId, userId);
  }

  const isFirstMessage = getRecentMessages(chatId, 1).length === 0;
  const encoder = new TextEncoder();
  let fullResponse = "";

  // Read uploaded files for this chat and inject contents
  const chatFiles = listChatFiles(chatId);
  const fileBlocks = chatFiles
    .map((f) => {
      const contents = readFileContents(chatId, f.filename);
      return contents ? `File: ${f.filename}\n\`\`\`\n${contents}\n\`\`\`` : null;
    })
    .filter((b): b is string => b !== null);

  const initialContent =
    fileBlocks.length > 0
      ? `${userText}\n\n[Files in this conversation]\n${fileBlocks.join("\n\n")}`
      : userText;

  const context: MessageContext = { graph: [], history: [], files: chatFiles, recent: false };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Streaming tool-use loop — streams immediately, detects tool calls mid-stream
        const msgs: Anthropic.MessageParam[] = [{ role: "user", content: initialContent }];

        for (let i = 0; i < 5; i++) {
          const claudeStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: MEMORY_TOOLS,
            messages: msgs,
          });

          for await (const chunk of claudeStream) {
            if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ thinking: getThinkingLabel(chunk.content_block.name) })}\n\n`)
              );
            }
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              fullResponse += chunk.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
            }
          }

          const finalMessage = await claudeStream.finalMessage();
          if (finalMessage.stop_reason !== "tool_use") break;

          msgs.push({ role: "assistant", content: finalMessage.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMessage.content) {
            if (block.type !== "tool_use") continue;
            const { result, partialContext } = await executeTool(
              block.name,
              block.input as Record<string, string>,
              chatId
            );
            if (partialContext.graph) context.graph.push(...partialContext.graph);
            if (partialContext.history) context.history.push(...partialContext.history);
            if (partialContext.recent) context.recent = true;
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }

          msgs.push({ role: "user", content: toolResults });
        }

        const now = new Date().toISOString();
        const userMessage: Message = { id: userId, role: "user", content: userText, timestamp: now };
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: fullResponse,
          timestamp: now,
        };

        await Promise.all([
          appendMessage(chatId, userMessage, assistantMessage, context),
          processConversation(chatId, userText, fullResponse).catch(() => {}),
          indexExchange(chatId, userText, fullResponse, now).catch(() => {}),
        ]);

        let title: string | undefined;
        if (isFirstMessage) {
          title = await generateTitle(userText);
          updateChatMeta(chatId, { title, updatedAt: now });
        } else {
          updateChatMeta(chatId, { updatedAt: now });
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, messageId, userMessageId: userId, context, title })}\n\n`
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

  const graphFacts = await queryGraphMemory("");
  const graphSummary = graphFacts
    .map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`)
    .join("\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
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
