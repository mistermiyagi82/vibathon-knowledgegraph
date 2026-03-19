import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { anthropic, SYSTEM_PROMPT, buildPrompt } from "@/lib/anthropic";
import { queryGraphMemory, writeEntities } from "@/lib/memory/graph";
import { semanticSearch } from "@/lib/memory/semantic";
import { getRecentMessages, formatRecentMessages } from "@/lib/memory/recent";
import { appendMessage, updateChatMeta, listChats } from "@/lib/storage/chats";
import { extractEntities } from "@/lib/entities/extractor";
import type { Message, MessageContext } from "@/types";

// POST /api/chats/:chatId/messages — send a message and stream Claude's response
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { message: userText } = await req.json();

  const messageId = uuid();
  const userId = uuid();

  // Handle /memory command
  if (userText.trim().toLowerCase() === "/memory") {
    return handleMemoryCommand(chatId, messageId, userId);
  }

  // Build memory context
  const recentMsgs = getRecentMessages(chatId, 10);
  const [graphFacts, historyExcerpts] = await Promise.all([
    queryGraphMemory(userText),
    semanticSearch(userText, chatId),
  ]);

  const context: MessageContext = {
    graph: graphFacts,
    history: historyExcerpts,
    files: [],
    recent: recentMsgs.length > 0,
  };

  const prompt = buildPrompt({
    graphFacts: graphFacts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n"),
    historyExcerpts: historyExcerpts.map((h) => `[${h.chatTitle}] ${h.excerpt}`).join("\n\n"),
    recentMessages: formatRecentMessages(recentMsgs),
    userMessage: userText,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";
  const isFirstMessage = recentMsgs.length === 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of claudeStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullResponse += chunk.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
          }
        }

        const now = new Date().toISOString();
        const userMessage: Message = {
          id: userId,
          role: "user",
          content: userText,
          timestamp: now,
        };
        const assistantMessage: Message = {
          id: messageId,
          role: "assistant",
          content: fullResponse,
          timestamp: now,
        };

        // Persist + extract entities in parallel
        await Promise.all([
          appendMessage(chatId, userMessage, assistantMessage, context),
          extractEntities(userText, fullResponse).then(writeEntities).catch(() => {}),
        ]);

        // Generate title after first message
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
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

  const [graphFacts] = await Promise.all([queryGraphMemory("")]);

  const graphSummary = graphFacts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n");

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
        const assistantMessage: Message = { id: messageId, role: "assistant", content: fullResponse, timestamp: now };
        const context: MessageContext = { graph: graphFacts, history: [], files: [], recent: false };

        await appendMessage(chatId, userMessage, assistantMessage, context);
        updateChatMeta(chatId, { updatedAt: now });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, messageId, userMessageId: userId, context })}\n\n`)
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
