import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { anthropic, SYSTEM_PROMPT, buildPrompt } from "@/lib/anthropic";
import { queryGraphMemory, writeEntities } from "@/lib/memory/graph";
import { semanticSearch } from "@/lib/memory/semantic";
import { appendMessage, updateChatMeta } from "@/lib/storage/chats";
import { extractEntities } from "@/lib/entities/extractor";
import type { Message, MessageContext } from "@/types";

// POST /api/chats/:chatId/messages — send a message and stream Claude's response
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { message: userText } = await req.json();

  const messageId = uuid();

  // Build memory context
  const [graphFacts, historyExcerpts] = await Promise.all([
    queryGraphMemory(userText),
    semanticSearch(userText),
  ]);

  const context: MessageContext = {
    graph: graphFacts,
    history: historyExcerpts,
    files: [],
    recent: true,
  };

  const prompt = buildPrompt({
    graphFacts: graphFacts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n"),
    historyExcerpts: historyExcerpts.map((h) => `[${h.chatTitle}] ${h.excerpt}`).join("\n\n"),
    recentMessages: "", // TODO: inject recent messages
    userMessage: userText,
  });

  // Stream response via SSE
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
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

      // Post-processing after stream completes
      const userMessage: Message = {
        id: uuid(),
        role: "user",
        content: userText,
        timestamp: new Date().toISOString(),
      };
      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };

      await Promise.all([
        // 1. Persist to MD
        appendMessage(chatId, userMessage, assistantMessage, context),
        // 2. Extract entities → Neo4j
        extractEntities(userText, fullResponse).then(writeEntities),
      ]);

      updateChatMeta(chatId, { updatedAt: new Date().toISOString() });

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, messageId, context })}\n\n`));
      controller.close();
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
