import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseMessages } from "@/lib/storage/chats";

const DATA_PATH = process.env.DATA_PATH || "./data";

// GET /api/chats/:chatId — load full message history
export async function GET(_req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const metaPath = path.join(DATA_PATH, "chats", chatId, "meta.json");

  if (!fs.existsSync(metaPath)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  const messages = parseMessages(chatId);

  return NextResponse.json({ meta, messages });
}

// PATCH /api/chats/:chatId — update agentConfig fields (e.g. systemPrompt)
export async function PATCH(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const metaPath = path.join(DATA_PATH, "chats", chatId, "meta.json");

  if (!fs.existsSync(metaPath)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const body = await req.json();
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

  if (body.systemPrompt !== undefined) {
    meta.agentConfig = { ...(meta.agentConfig || {}), systemPrompt: body.systemPrompt };
  }

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
