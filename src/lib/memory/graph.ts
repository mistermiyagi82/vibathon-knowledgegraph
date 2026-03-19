import { runQuery } from "@/lib/neo4j";
import type { GraphFact } from "@/types";

// Query the knowledge graph for facts relevant to the current message
export async function queryGraphMemory(userMessage: string): Promise<GraphFact[]> {
  if (!process.env.NEO4J_URI) return [];

  try {
    const results = await runQuery<{ subject: string; relationship: string; object: string }>(
      `MATCH (a)-[r]->(b)
       RETURN a.name AS subject, type(r) AS relationship, b.name AS object
       LIMIT 20`
    );
    return results;
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
