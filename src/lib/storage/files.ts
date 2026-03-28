import fs from "fs";
import path from "path";
import type { FileAttachment } from "@/types";

const DATA_PATH = process.env.DATA_PATH || "./data";

export function saveFile(chatId: string, filename: string, buffer: Buffer): FileAttachment {
  const dir = path.join(DATA_PATH, "uploads", chatId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return {
    filename,
    type: path.extname(filename).slice(1),
    path: `/api/files/${chatId}/${filename}`,
    chatId,
  };
}

export function getFilePath(chatId: string, filename: string): string {
  return path.join(DATA_PATH, "uploads", chatId, filename);
}

export function listChatFiles(chatId: string): FileAttachment[] {
  const uploadsDir = path.join(DATA_PATH, "uploads", chatId);
  if (!fs.existsSync(uploadsDir)) return [];

  return fs.readdirSync(uploadsDir)
    .filter((filename) => !filename.endsWith(".pdf.txt"))
    .map((filename) => ({
      filename,
      type: path.extname(filename).slice(1),
      path: `/api/files/${chatId}/${filename}`,
      chatId,
    }));
}

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".csv", ".json", ".ts", ".js", ".tsx", ".jsx",
  ".py", ".html", ".css", ".xml", ".yaml", ".yml", ".sh", ".sql",
]);

export function readFileContents(chatId: string, filename: string, maxBytes = 40000): string | null {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const sidecarPath = path.join(DATA_PATH, "uploads", chatId, filename + ".txt");
    if (!fs.existsSync(sidecarPath)) return null;
    try {
      const buffer = fs.readFileSync(sidecarPath);
      const text = buffer.subarray(0, maxBytes).toString("utf-8");
      return buffer.length > maxBytes ? text + "\n[truncated]" : text;
    } catch {
      return null;
    }
  }

  if (!TEXT_EXTENSIONS.has(ext)) return null;

  const filePath = path.join(DATA_PATH, "uploads", chatId, filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.subarray(0, maxBytes).toString("utf-8");
    return buffer.length > maxBytes ? text + "\n[truncated]" : text;
  } catch {
    return null;
  }
}

export async function extractPdfText(chatId: string, filename: string): Promise<string | null> {
  const filePath = path.join(DATA_PATH, "uploads", chatId, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const text = data.text?.trim();
    if (!text) return null;
    fs.writeFileSync(filePath + ".txt", text, "utf-8");
    return text;
  } catch {
    return null;
  }
}

export function listAllFiles(): FileAttachment[] {
  const uploadsDir = path.join(DATA_PATH, "uploads");
  if (!fs.existsSync(uploadsDir)) return [];

  const files: FileAttachment[] = [];
  for (const chatId of fs.readdirSync(uploadsDir)) {
    const chatUploads = path.join(uploadsDir, chatId);
    for (const filename of fs.readdirSync(chatUploads)) {
      files.push({
        filename,
        type: path.extname(filename).slice(1),
        path: `/api/files/${chatId}/${filename}`,
        chatId,
      });
    }
  }
  return files;
}
