import fs from "fs";
import path from "path";
import { SYSTEM_PROMPT } from "./anthropic";

const PROMPT_PATH = path.join(process.env.DATA_PATH || "./data", "system-prompt.txt");

export function getSystemPrompt(): string {
  try {
    if (fs.existsSync(PROMPT_PATH)) {
      const custom = fs.readFileSync(PROMPT_PATH, "utf-8").trim();
      if (custom) return custom;
    }
  } catch {}
  return SYSTEM_PROMPT;
}

export function saveSystemPrompt(prompt: string): void {
  const dir = path.dirname(PROMPT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROMPT_PATH, prompt, "utf-8");
}
