import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { cosineSimilarity } from "./embed";
import type { HistoryExcerpt } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";
const DB_PATH = path.join(DATA_PATH, "embeddings.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DATA_PATH, { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id         TEXT PRIMARY KEY,
      chat_id    TEXT NOT NULL,
      chat_title TEXT,
      timestamp  TEXT,
      excerpt    TEXT NOT NULL,
      embedding  TEXT NOT NULL
    )
  `);

  return _db;
}

interface ChunkRow {
  id: string;
  chat_id: string;
  chat_title: string | null;
  timestamp: string | null;
  excerpt: string;
  embedding: string;
}

export function indexChunk(params: {
  chatId: string;
  chatTitle: string | null;
  timestamp: string;
  excerpt: string;
  embedding: number[];
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO chunks (id, chat_id, chat_title, timestamp, excerpt, embedding)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `${params.chatId}:${params.timestamp}`,
    params.chatId,
    params.chatTitle,
    params.timestamp,
    params.excerpt,
    JSON.stringify(params.embedding)
  );
}

export function searchChunks(
  queryEmbedding: number[],
  excludeChatId?: string,
  limit = 5
): HistoryExcerpt[] {
  const db = getDb();

  const rows = (
    excludeChatId
      ? db.prepare("SELECT * FROM chunks WHERE chat_id != ?").all(excludeChatId)
      : db.prepare("SELECT * FROM chunks").all()
  ) as ChunkRow[];

  if (rows.length === 0) return [];

  return rows
    .map((row) => {
      let embedding: number[] = [];
      try { embedding = JSON.parse(row.embedding); } catch { /* skip */ }
      return {
        chatId: row.chat_id,
        chatTitle: row.chat_title ?? row.chat_id,
        timestamp: row.timestamp ?? "",
        excerpt: row.excerpt,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...r }) => r);
}
