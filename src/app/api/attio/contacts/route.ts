import { NextResponse } from "next/server";
import { searchAttioContacts } from "@/lib/attio";

// GET /api/attio/contacts?search=query — search Attio contacts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  if (!search.trim()) {
    return NextResponse.json([]);
  }

  if (!process.env.ATTIO_API_KEY) {
    return NextResponse.json({ error: "ATTIO_API_KEY not configured" }, { status: 503 });
  }

  try {
    const contacts = await searchAttioContacts(search.trim());
    return NextResponse.json(contacts);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
