import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SYSTEM_PROMPT = `You are a persistent assistant with long-term memory.
You have an ongoing relationship with this user.
Speak from memory naturally — not as if reading a database.`;

export function buildPrompt({
  graphFacts,
  historyExcerpts,
  recentMessages,
  userMessage,
}: {
  graphFacts: string;
  historyExcerpts: string;
  recentMessages: string;
  userMessage: string;
}): string {
  return `[Memory — Graph Facts]
Here is what you know about the user and past topics:
${graphFacts}

[Memory — Relevant Past]
Relevant excerpts from past conversations:
${historyExcerpts}

[Memory — Recent]
Recent messages from this chat:
${recentMessages}

[User message]
${userMessage}`;
}
