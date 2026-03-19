import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { MessageContext } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

// GET /api/context/:messageId — return context used for a specific message
export async function GET(_req: Request, { params }: { params: { messageId: string } }) {
  const { messageId } = params;
  const chatsDir = path.join(DATA_PATH, "chats");

  // Search all chat files for this messageId
  for (const chatId of fs.readdirSync(chatsDir)) {
    const filePath = path.join(chatsDir, chatId, "messages.md");
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const contextMatch = content.match(
      new RegExp(`\\[context: (\\{[^\\]]+\\})\\](?=[\\s\\S]*?${messageId}|${messageId}[\\s\\S]*?\\[context:)`)
    );

    if (contextMatch) {
      try {
        const context = JSON.parse(contextMatch[1]) as MessageContext;
        return NextResponse.json(context);
      } catch {
        break;
      }
    }
  }

  return NextResponse.json({ error: "Context not found" }, { status: 404 });
}
