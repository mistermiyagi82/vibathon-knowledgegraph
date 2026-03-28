import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { listChats, createChat, updateChatMeta } from "@/lib/storage/chats";
import { getAttioContact } from "@/lib/attio";
import { graphitiIngestContact, graphitiHealthy } from "@/lib/graphiti";
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

  // Await Attio fetch before returning — guarantees cache is ready before first message
  if (contactId) {
    const contact = await getAttioContact(contactId).catch(() => null);
    if (contact) {
      updateChatMeta(id, { cachedContact: contact });
      // Fire-and-forget: ingest candidate profile + vacancy into Graphiti knowledge graph
      graphitiHealthy().then((ok) => {
        if (!ok) return;
        return graphitiIngestContact(id, contact).catch(() => {});
      });
    }
  }

  return NextResponse.json(chat, { status: 201 });
}
