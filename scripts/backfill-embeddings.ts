/**
 * Backfill embeddings for all existing chats.
 * Run with: npx tsx scripts/backfill-embeddings.ts
 *
 * Skips exchanges already in the DB (idempotent — safe to re-run).
 * Respects Voyage API rate limits with a small delay between calls.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env") });

const DATA_PATH = process.env.DATA_PATH || "./data";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const DB_PATH = path.join(DATA_PATH, "embeddings.db");

if (!VOYAGE_API_KEY) {
  console.error("VOYAGE_API_KEY not set — aborting");
  process.exit(1);
}

// --- DB setup ---
fs.mkdirSync(DATA_PATH, { recursive: true });
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL,
    chat_title TEXT,
    timestamp  TEXT,
    excerpt    TEXT NOT NULL,
    embedding  TEXT NOT NULL
  )
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO chunks (id, chat_id, chat_title, timestamp, excerpt, embedding)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const exists = db.prepare("SELECT 1 FROM chunks WHERE id = ?");

// --- Helpers ---

async function embedText(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ model: "voyage-3-lite", input: [text] }),
    });
    if (!res.ok) {
      console.error(`  Voyage error ${res.status}: ${await res.text()}`);
      return null;
    }
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("  fetch failed:", err);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface Exchange {
  timestamp: string;
  userContent: string;
  assistantContent: string;
}

function parseExchanges(mdContent: string): Exchange[] {
  const blocks = mdContent.split(/\n(?=## \d{4}-\d{2}-\d{2}T)/).filter((b) => b.trim());
  const exchanges: Exchange[] = [];

  for (const block of blocks) {
    const tsMatch = block.match(/^## (\S+)/);
    if (!tsMatch) continue;
    const timestamp = tsMatch[1];

    const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=<!-- assistant-id:|$)/);
    const assistantMatch = block.match(/\*\*Claude:\*\* ([\s\S]*?)(?=<!-- context:|$)/);

    const userContent = userMatch?.[1]?.replace(/\[file:[^\]]+\]\([^)]+\)/g, "").trim() ?? "";
    const assistantContent = assistantMatch?.[1]?.trim() ?? "";

    if (userContent || assistantContent) {
      exchanges.push({ timestamp, userContent, assistantContent });
    }
  }

  return exchanges;
}

// --- Main ---

async function main() {
  const chatsDir = path.join(DATA_PATH, "chats");
  if (!fs.existsSync(chatsDir)) {
    console.log("No chats found — nothing to backfill.");
    return;
  }

  const chatIds = fs.readdirSync(chatsDir);
  console.log(`Found ${chatIds.length} chat(s)\n`);

  let total = 0;
  let skipped = 0;
  let indexed = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    const messagesPath = path.join(chatsDir, chatId, "messages.md");
    const metaPath = path.join(chatsDir, chatId, "meta.json");
    if (!fs.existsSync(messagesPath)) continue;

    const chatTitle = fs.existsSync(metaPath)
      ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")).title ?? chatId)
      : chatId;

    const content = fs.readFileSync(messagesPath, "utf-8");
    const exchanges = parseExchanges(content);

    console.log(`Chat: "${chatTitle}" — ${exchanges.length} exchange(s)`);

    for (const ex of exchanges) {
      total++;
      const id = `${chatId}:${ex.timestamp}`;

      if (exists.get(id)) {
        skipped++;
        process.stdout.write("  · skipped (already indexed)\n");
        continue;
      }

      const excerpt = `User: ${ex.userContent.slice(0, 500)}\n\nClaude: ${ex.assistantContent.slice(0, 500)}`;
      const embedding = await embedText(excerpt);

      if (!embedding) {
        failed++;
        process.stdout.write(`  ✗ failed: ${ex.timestamp}\n`);
        continue;
      }

      insert.run(id, chatId, chatTitle, ex.timestamp, excerpt, JSON.stringify(embedding));
      indexed++;
      process.stdout.write(`  ✓ ${ex.timestamp}\n`);

      // Small delay to avoid hitting Voyage rate limits
      await sleep(100);
    }
  }

  console.log(`\nDone. ${indexed} indexed, ${skipped} skipped, ${failed} failed (out of ${total} total)`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
