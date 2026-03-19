import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { indexChunk } from "@/lib/memory/vectordb";

const DATA_PATH = process.env.DATA_PATH || "./data";
const BATCH_SIZE = 20; // Voyage accepts up to 128 inputs per call

function parseExchanges(mdContent: string) {
  const blocks = mdContent.split(/\n(?=## \d{4}-\d{2}-\d{2}T)/).filter((b) => b.trim());
  return blocks.flatMap((block) => {
    const tsMatch = block.match(/^## (\S+)/);
    if (!tsMatch) return [];
    const timestamp = tsMatch[1];
    const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=<!-- assistant-id:|$)/);
    const assistantMatch = block.match(/\*\*Claude:\*\* ([\s\S]*?)(?=<!-- context:|$)/);
    const userContent = userMatch?.[1]?.replace(/\[file:[^\]]+\]\([^)]+\)/g, "").trim() ?? "";
    const assistantContent = assistantMatch?.[1]?.trim() ?? "";
    if (!userContent && !assistantContent) return [];
    return [{ timestamp, userContent, assistantContent }];
  });
}

async function embedBatch(texts: string[]): Promise<number[][] | null> {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ model: "voyage-3-lite", input: texts }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Voyage batch error ${res.status}: ${body}`);
      return null;
    }
    const json = await res.json();
    return json.data.map((d: { embedding: number[] }) => d.embedding);
  } catch (err) {
    console.error("Voyage batch failed:", err);
    return null;
  }
}

export async function POST() {
  if (!process.env.VOYAGE_API_KEY) {
    return NextResponse.json({ error: "VOYAGE_API_KEY not set" }, { status: 500 });
  }

  const chatsDir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(chatsDir)) {
    return NextResponse.json({ indexed: 0, failed: 0 });
  }

  // Collect all exchanges across all chats
  const items: Array<{ chatId: string; chatTitle: string; timestamp: string; excerpt: string }> = [];

  for (const chatId of fs.readdirSync(chatsDir)) {
    const messagesPath = path.join(chatsDir, chatId, "messages.md");
    const metaPath = path.join(chatsDir, chatId, "meta.json");
    if (!fs.existsSync(messagesPath)) continue;

    const chatTitle = fs.existsSync(metaPath)
      ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")).title ?? chatId)
      : chatId;

    for (const ex of parseExchanges(fs.readFileSync(messagesPath, "utf-8"))) {
      items.push({
        chatId,
        chatTitle,
        timestamp: ex.timestamp,
        excerpt: `User: ${ex.userContent.slice(0, 500)}\n\nClaude: ${ex.assistantContent.slice(0, 500)}`,
      });
    }
  }

  let indexed = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((b) => b.excerpt));

    if (!embeddings) {
      failed += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      indexChunk({ ...batch[j], embedding: embeddings[j] });
      indexed++;
    }
  }

  return NextResponse.json({ indexed, failed, total: items.length });
}
