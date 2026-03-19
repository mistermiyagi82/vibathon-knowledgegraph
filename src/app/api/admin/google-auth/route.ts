import { NextResponse } from "next/server";
import { getGoogleAuthUrl, exchangeGoogleCode } from "@/lib/calendar";

// GET /api/admin/google-auth — returns the OAuth URL to authenticate a user
export async function GET() {
  try {
    const url = getGoogleAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/google-auth — exchange code for refresh token
export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
    const result = await exchangeGoogleCode(code);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
