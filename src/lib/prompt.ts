import fs from "fs";
import path from "path";
import { SYSTEM_PROMPT } from "./anthropic";

const DATA_PATH = process.env.DATA_PATH || "./data";
const PROMPT_PATH = path.join(DATA_PATH, "system-prompt.txt");
const SKILLS_DIR = path.join(DATA_PATH, "skills");

export function getSystemPrompt(): string {
  let base = SYSTEM_PROMPT;
  try {
    if (fs.existsSync(PROMPT_PATH)) {
      const custom = fs.readFileSync(PROMPT_PATH, "utf-8").trim();
      if (custom) base = custom;
    }
  } catch {}

  // Append skill files
  try {
    if (fs.existsSync(SKILLS_DIR)) {
      const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md")).sort();
      const skills = files
        .map((f) => {
          const content = fs.readFileSync(path.join(SKILLS_DIR, f), "utf-8").trim();
          return content ? `## ${f.replace(".md", "")}\n${content}` : null;
        })
        .filter(Boolean)
        .join("\n\n");
      if (skills) base += `\n\n---\n\n${skills}`;
    }
  } catch {}

  return base;
}

export function saveSystemPrompt(prompt: string): void {
  const dir = path.dirname(PROMPT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROMPT_PATH, prompt, "utf-8");
}
