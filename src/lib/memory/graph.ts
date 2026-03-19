import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { GraphFact } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";
const DB_PATH = path.join(DATA_PATH, "embeddings.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_PATH, { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      subject      TEXT NOT NULL,
      relationship TEXT NOT NULL,
      object       TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      chat_id      TEXT,
      UNIQUE(subject, relationship, object, chat_id)
    )
  `);

  // Migrate: add chat_id column if it doesn't exist yet
  const cols = (_db.prepare("PRAGMA table_info(facts)").all() as Array<{ name: string }>).map(c => c.name);
  if (!cols.includes("chat_id")) {
    _db.exec("ALTER TABLE facts ADD COLUMN chat_id TEXT");
    // Also drop old unique constraint and recreate (SQLite doesn't support DROP CONSTRAINT)
    // The new table was created with the new unique constraint above, so existing DBs just get the column
  }

  return _db;
}

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "how", "that", "this", "these",
  "those", "with", "from", "have", "been", "will", "would", "could", "should",
  "about", "your", "does", "know", "tell", "more", "also", "just", "like",
  "than", "then", "some", "into", "over", "after", "such", "make", "they",
  "them", "their", "there", "here", "time", "very", "much", "dont", "cant",
  "help", "need", "want", "give", "show", "find", "using", "used", "use",
]);

function extractKeywords(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

export async function queryGraphMemory(userMessage: string, chatId?: string): Promise<GraphFact[]> {
  try {
    const db = getDb();
    const keywords = extractKeywords(userMessage);

    if (keywords.length > 0) {
      // Search chat-scoped facts first if chatId provided
      if (chatId) {
        const conditions = keywords.map(() =>
          `(LOWER(subject) LIKE ? OR LOWER(relationship) LIKE ? OR LOWER(object) LIKE ?)`
        ).join(" OR ");
        const params = keywords.flatMap((kw) => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);
        const rows = db.prepare(
          `SELECT subject, relationship, object FROM facts WHERE chat_id = ? AND (${conditions}) ORDER BY id DESC LIMIT 20`
        ).all(chatId, ...params) as GraphFact[];
        if (rows.length > 0) return rows;
      }

      // Fall back to global facts (no chat_id)
      const conditions = keywords.map(() =>
        `(LOWER(subject) LIKE ? OR LOWER(relationship) LIKE ? OR LOWER(object) LIKE ?)`
      ).join(" OR ");
      const params = keywords.flatMap((kw) => [`%${kw}%`, `%${kw}%`, `%${kw}%`]);
      const rows = db.prepare(
        `SELECT subject, relationship, object FROM facts WHERE chat_id IS NULL AND (${conditions}) ORDER BY id DESC LIMIT 20`
      ).all(...params) as GraphFact[];
      if (rows.length > 0) return rows;
    }

    // Fallback: return most recent facts (scoped first, then global)
    if (chatId) {
      const rows = db.prepare(
        `SELECT subject, relationship, object FROM facts WHERE chat_id = ? ORDER BY id DESC LIMIT 20`
      ).all(chatId) as GraphFact[];
      if (rows.length > 0) return rows;
    }

    return db.prepare(
      `SELECT subject, relationship, object FROM facts WHERE chat_id IS NULL ORDER BY id DESC LIMIT 30`
    ).all() as GraphFact[];
  } catch {
    return [];
  }
}

export async function writeEntities(
  entities: Array<{ subject: string; relationship: string; object: string }>,
  chatId?: string
): Promise<void> {
  if (entities.length === 0) return;
  try {
    const db = getDb();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO facts (subject, relationship, object, created_at, chat_id)
       VALUES (?, ?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    const insertMany = db.transaction((items: typeof entities) => {
      for (const { subject, relationship, object } of items) {
        insert.run(
          subject,
          relationship.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
          object,
          now,
          chatId ?? null
        );
      }
    });
    insertMany(entities);
  } catch {
    // Silently fail — graph is not critical
  }
}
