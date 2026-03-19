import { NextResponse } from "next/server";
import fs from "fs";
import { getFilePath } from "@/lib/storage/files";

// GET /api/files/:chatId/:filename — download a file
export async function GET(
  _req: Request,
  { params }: { params: { chatId: string; filename: string } }
) {
  const { chatId, filename } = params;
  const filePath = getFilePath(chatId, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
