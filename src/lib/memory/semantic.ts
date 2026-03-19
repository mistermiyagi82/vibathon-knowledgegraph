import fs from "fs";
import path from "path";
import type { HistoryExcerpt } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

// v1: keyword search over all past MD files
export async function semanticSearch(
  query: string,
  excludeChatId?: string,
  limit = 5
): Promise<HistoryExcerpt[]> {
  const chatsDir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(chatsDir)) return [];

  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: Array<HistoryExcerpt & { score: number }> = [];

  const chatIds = fs.readdirSync(chatsDir);
  for (const chatId of chatIds) {
    if (excludeChatId && chatId === excludeChatId) continue;
    const messagesPath = path.join(chatsDir, chatId, "messages.md");
    const metaPath = path.join(chatsDir, chatId, "meta.json");
    if (!fs.existsSync(messagesPath)) continue;

    const content = fs.readFileSync(messagesPath, "utf-8");
    const meta = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, "utf-8"))
      : { title: chatId };

    // Split into message blocks and score each
    const blocks = content.split(/^## /m).filter(Boolean);
    for (const block of blocks) {
      const lower = block.toLowerCase();
      const score = keywords.filter((k) => lower.includes(k)).length;
      if (score > 0) {
        const lines = block.split("\n");
        results.push({
          chatId,
          chatTitle: meta.title,
          timestamp: lines[0]?.trim() ?? "",
          excerpt: lines.slice(1, 5).join("\n").trim(),
          score,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...r }) => r);
}
