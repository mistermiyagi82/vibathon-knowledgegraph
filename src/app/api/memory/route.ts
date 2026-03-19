import { NextResponse } from "next/server";
import { queryGraphMemory } from "@/lib/memory/graph";
import { listAllFiles } from "@/lib/storage/files";
import { listChats } from "@/lib/storage/chats";
import type { MemoryOverview } from "@/types";

// GET /api/memory — current graph state for sidebar overview
export async function GET() {
  const [facts, files, chats] = await Promise.all([
    queryGraphMemory(""),
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
