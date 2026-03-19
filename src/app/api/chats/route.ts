import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { listChats, createChat } from "@/lib/storage/chats";

// GET /api/chats — list all chats
export async function GET() {
  const chats = listChats();
  return NextResponse.json(chats);
}

// POST /api/chats — create a new chat
export async function POST() {
  const id = uuid();
  const chat = createChat(id);
  return NextResponse.json(chat, { status: 201 });
}
