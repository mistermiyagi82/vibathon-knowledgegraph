import { anthropic } from "@/lib/anthropic";
import { getRecentMessages, formatRecentMessages } from "@/lib/memory/recent";
import { queryGraphMemory, writeEntities } from "@/lib/memory/graph";

// Conversation memory builder — processes the full conversation context into the knowledge graph.
// Unlike the old per-exchange extractor, this sees:
//   - The last 20 messages for full conversational context
//   - What's already in the graph, so it only adds what's new or changed
export async function processConversation(
  chatId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  const recentMessages = getRecentMessages(chatId, 20);
  const conversationContext = formatRecentMessages(recentMessages);

  // Get existing graph facts scoped to this chat
  const existingFacts = await queryGraphMemory("", chatId);
  const existingFactsStr =
    existingFacts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n") ||
    "(none yet)";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are building a long-term memory graph for a personal AI companion. Your job is to extract facts worth remembering for months — things that reveal who this person is, what they care about, and what they're doing.

ALREADY IN MEMORY (do not re-add these):
${existingFactsStr}

RECENT CONVERSATION (context):
${conversationContext || "(none yet)"}

LATEST EXCHANGE:
User: ${userMessage}
Assistant: ${assistantResponse}

Extract only NEW or CHANGED facts not already captured above. Focus on:
- Preferences, opinions, values ("user PREFERS TypeScript over Python")
- Projects and their current status ("user BUILDING payment API")
- Decisions made ("user DECIDED to use Next.js")
- Goals and ambitions ("user WANTS to launch by April")
- Tools, workflows, tech stack ("user USES Cursor for coding")
- Important people or relationships ("user WORKS_WITH designer named Sara")
- Things they explicitly want remembered

Skip: greetings, filler, questions that reveal nothing, ephemeral states ("I'm tired today"), anything already in memory.

Return ONLY a JSON array — no markdown, no explanation.
Each item: { "subject": string, "relationship": string, "object": string }
Use UPPERCASE_WITH_UNDERSCORES for relationships. Subject is usually "user" or a named entity.
Return [] if there is genuinely nothing new worth adding.`,
      },
    ],
  });

  try {
    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const json = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const entities = JSON.parse(json);
    if (Array.isArray(entities) && entities.length > 0) {
      await writeEntities(entities, chatId);
    }
  } catch {
    // Memory building is non-critical — silently fail
  }
}
