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
