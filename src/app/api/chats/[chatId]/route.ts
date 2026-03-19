import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = process.env.DATA_PATH || "./data";

// GET /api/chats/:chatId — load full message history
export async function GET(_req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const messagesPath = path.join(DATA_PATH, "chats", chatId, "messages.md");
  const metaPath = path.join(DATA_PATH, "chats", chatId, "meta.json");

  if (!fs.existsSync(messagesPath)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const messages = fs.readFileSync(messagesPath, "utf-8");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

  return NextResponse.json({ meta, messages });
}
