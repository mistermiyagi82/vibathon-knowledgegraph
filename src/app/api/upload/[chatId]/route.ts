import { NextResponse } from "next/server";
import { saveFile, extractPdfText } from "@/lib/storage/files";
import { graphitiIngestEpisode, graphitiHealthy } from "@/lib/graphiti";
import { getChatMeta } from "@/lib/storage/chats";
import { uploadFileToContact } from "@/lib/attio";
import path from "path";

// POST /api/upload/:chatId — upload a file
export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const attachment = saveFile(chatId, file.name, buffer);

  // PDF: extract text + index into Graphiti + upload to Attio (all fire-and-forget)
  if (path.extname(file.name).toLowerCase() === ".pdf") {
    const meta = getChatMeta(chatId);

    // Extract text → index into Graphiti
    extractPdfText(chatId, file.name).then(async (text) => {
      if (!text) return;
      const ok = await graphitiHealthy();
      if (ok) {
        graphitiIngestEpisode(chatId, `file-${file.name}`, `[CV: ${file.name}]\n${text}`).catch(() => {});
      }
    }).catch(() => {});

    // Upload the actual PDF binary to the linked Attio contact
    if (meta?.contactId) {
      uploadFileToContact(meta.contactId, file.name, buffer, file.type || "application/pdf").catch(() => {});
    }
  }

  return NextResponse.json(attachment, { status: 201 });
}
