import { NextResponse } from "next/server";
import { getSystemPrompt, saveSystemPrompt } from "@/lib/prompt";

export async function GET() {
  return NextResponse.json({ prompt: getSystemPrompt() });
}

export async function PUT(req: Request) {
  const { prompt } = await req.json();
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
  }
  saveSystemPrompt(prompt.trim());
  return NextResponse.json({ ok: true });
}
