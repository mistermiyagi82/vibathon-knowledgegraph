import { NextResponse } from "next/server";
import { findContextForMessage } from "@/lib/storage/chats";

// GET /api/context/:messageId — return context used for a specific message
export async function GET(_req: Request, { params }: { params: { messageId: string } }) {
  const { messageId } = params;
  const context = findContextForMessage(messageId);

  if (!context) {
    return NextResponse.json({ error: "Context not found" }, { status: 404 });
  }

  return NextResponse.json(context);
}
