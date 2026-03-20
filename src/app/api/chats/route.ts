import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { listChats, createChat } from "@/lib/storage/chats";
import fs from "fs";
import path from "path";
import type { AgentConfig } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

// GET /api/chats — list all chats
export async function GET() {
  const chats = listChats();
  return NextResponse.json(chats);
}

// POST /api/chats — create a new chat
export async function POST(req: Request) {
  const id = uuid();
  let contactId: string | undefined;
  let contactName: string | undefined;
  let templateId: string | undefined;
  let agentConfig: AgentConfig | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    contactId = body.contactId;
    contactName = body.contactName;
    templateId = body.templateId;

    // Load template config if templateId provided
    if (templateId) {
      const templatePath = path.join(process.cwd(), "templates", `${templateId}.json`);
      if (fs.existsSync(templatePath)) {
        const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
        agentConfig = {
          systemPrompt: template.systemPrompt,
          model: template.model,
          tools: template.tools,
        };
      }
    }
  } catch { /* use defaults */ }

  const chat = createChat(id, { contactId, contactName, templateId, agentConfig });
  return NextResponse.json(chat, { status: 201 });
}
