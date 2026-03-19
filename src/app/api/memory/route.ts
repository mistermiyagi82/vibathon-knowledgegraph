import { NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { listAllFiles } from "@/lib/storage/files";
import { listChats } from "@/lib/storage/chats";
import type { MemoryOverview } from "@/types";

// GET /api/memory — current graph state for sidebar overview
export async function GET() {
  const [facts, files, chats] = await Promise.all([
    runQuery<{ subject: string; relationship: string; object: string }>(
      `MATCH (a)-[r]->(b) RETURN a.name AS subject, type(r) AS relationship, b.name AS object LIMIT 30`
    ),
    Promise.resolve(listAllFiles()),
    Promise.resolve(listChats()),
  ]);

  const overview: MemoryOverview = {
    facts,
    files,
    stats: {
      totalChats: chats.length,
      firstSession: chats.at(-1)?.createdAt ?? "",
      lastSession: chats.at(0)?.updatedAt ?? "",
    },
  };

  return NextResponse.json(overview);
}
