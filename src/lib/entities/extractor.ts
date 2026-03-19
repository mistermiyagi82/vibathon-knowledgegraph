import { anthropic } from "@/lib/anthropic";

interface Entity {
  subject: string;
  relationship: string;
  object: string;
}

// Second Claude call after each response — extracts entities for the graph
export async function extractEntities(
  userMessage: string,
  assistantResponse: string
): Promise<Entity[]> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Extract entities and relationships from this exchange. Return ONLY a JSON array, no markdown, no explanation.
Each item: { "subject": string, "relationship": string, "object": string }
Use UPPERCASE_WITH_UNDERSCORES for relationship names (PREFERS, BUILDING, USES, KNOWS_ABOUT, DECIDED, DISCUSSED).

User: ${userMessage}
Assistant: ${assistantResponse}`,
      },
    ],
  });

  try {
    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(json) as Entity[];
  } catch {
    return [];
  }
}
