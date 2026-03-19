import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = process.env.DATA_PATH || "./data";

// GET /api/chats/:chatId/raw — return raw messages.md content
export async function GET(_req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const messagesPath = path.join(DATA_PATH, "chats", chatId, "messages.md");

  if (!fs.existsSync(messagesPath)) {
    return new NextResponse("", { status: 404 });
  }

  const content = fs.readFileSync(messagesPath, "utf-8");
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
