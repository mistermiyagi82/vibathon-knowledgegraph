import { runQuery } from "@/lib/neo4j";
import type { GraphFact } from "@/types";

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "how", "that", "this", "these",
  "those", "with", "from", "have", "been", "will", "would", "could", "should",
  "about", "your", "does", "know", "tell", "more", "also", "just", "like",
  "than", "then", "some", "into", "over", "after", "such", "make", "they",
  "them", "their", "there", "here", "time", "very", "much", "dont", "cant",
  "help", "need", "want", "give", "show", "find", "using", "used", "use",
]);

function extractKeywords(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

// Query the knowledge graph for facts relevant to the current message
export async function queryGraphMemory(userMessage: string): Promise<GraphFact[]> {
  if (!process.env.NEO4J_URI) return [];

  const keywords = extractKeywords(userMessage);

  try {
    // If we have keywords, do a targeted search first
    if (keywords.length > 0) {
      const targeted = await runQuery<{ subject: string; relationship: string; object: string }>(
        `MATCH (a)-[r]->(b)
         WHERE any(kw IN $keywords WHERE
           toLower(a.name) CONTAINS kw OR toLower(b.name) CONTAINS kw)
         RETURN a.name AS subject, type(r) AS relationship, b.name AS object
         LIMIT 20`,
        { keywords }
      );
      if (targeted.length > 0) return targeted;
    }

    // Fallback: return most recent facts (all, sorted by id descending if available)
    return await runQuery<{ subject: string; relationship: string; object: string }>(
      `MATCH (a)-[r]->(b)
       RETURN a.name AS subject, type(r) AS relationship, b.name AS object
       LIMIT 20`
    );
  } catch {
    return [];
  }
}

// Write entities extracted from an exchange to Neo4j
export async function writeEntities(
  entities: Array<{ subject: string; relationship: string; object: string }>
): Promise<void> {
  if (!process.env.NEO4J_URI || entities.length === 0) return;

  try {
    for (const { subject, relationship, object } of entities) {
      // Sanitize relationship to be a valid Neo4j relationship type
      const rel = relationship.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
      await runQuery(
        `MERGE (a:Entity {name: $subject})
         MERGE (b:Entity {name: $object})
         MERGE (a)-[:${rel}]->(b)`,
        { subject, object }
      );
    }
  } catch {
    // Silently fail — graph is not critical to chat functionality
  }
}
