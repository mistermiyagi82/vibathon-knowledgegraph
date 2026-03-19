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
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract all entities, facts, and relationships from this conversation exchange as JSON.
Return ONLY a JSON array with objects of shape: { subject, relationship, object }
Use uppercase for relationship names (e.g. PREFERS, BUILDING, USES, KNOWS_ABOUT).

User: ${userMessage}
Assistant: ${assistantResponse}`,
      },
    ],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    return JSON.parse(text) as Entity[];
  } catch {
    return [];
  }
}
