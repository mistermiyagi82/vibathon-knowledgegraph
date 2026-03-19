import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { embedText } from "@/lib/memory/embed";
import { indexChunk } from "@/lib/memory/vectordb";

const DATA_PATH = process.env.DATA_PATH || "./data";

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

export async function POST() {
  if (!process.env.VOYAGE_API_KEY) {
    return NextResponse.json({ error: "VOYAGE_API_KEY not set" }, { status: 500 });
  }

  const chatsDir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(chatsDir)) {
    return NextResponse.json({ indexed: 0, skipped: 0, failed: 0 });
  }

  let indexed = 0, skipped = 0, failed = 0;

  for (const chatId of fs.readdirSync(chatsDir)) {
    const messagesPath = path.join(chatsDir, chatId, "messages.md");
    const metaPath = path.join(chatsDir, chatId, "meta.json");
    if (!fs.existsSync(messagesPath)) continue;

    const chatTitle = fs.existsSync(metaPath)
      ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")).title ?? chatId)
      : chatId;

    const exchanges = parseExchanges(fs.readFileSync(messagesPath, "utf-8"));

    for (const ex of exchanges) {
      const excerpt = `User: ${ex.userContent.slice(0, 500)}\n\nClaude: ${ex.assistantContent.slice(0, 500)}`;
      const embedding = await embedText(excerpt);
      if (!embedding) { failed++; continue; }
      indexChunk({ chatId, chatTitle, timestamp: ex.timestamp, excerpt, embedding });
      indexed++;
    }
  }

  return NextResponse.json({ indexed, skipped, failed });
}
