import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { Template } from "@/types";

// Templates live in /templates at the project root (tracked in git, not in data volume)
const TEMPLATES_DIR = path.join(process.cwd(), "templates");

// GET /api/templates — list all templates
export async function GET() {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json")).sort();
    const templates: Template[] = files
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8")) as Template;
        } catch {
          return null;
        }
      })
      .filter((t): t is Template => t !== null);
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json([]);
  }
}
