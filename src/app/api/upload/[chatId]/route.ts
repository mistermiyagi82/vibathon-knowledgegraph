import { NextResponse } from "next/server";
import { saveFile } from "@/lib/storage/files";

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

  return NextResponse.json(attachment, { status: 201 });
}
