import { runQuery } from "@/lib/neo4j";
import type { GraphFact } from "@/types";

// Query the knowledge graph for facts relevant to the current message
export async function queryGraphMemory(userMessage: string): Promise<GraphFact[]> {
  // TODO: implement keyword extraction from userMessage to target query
  const results = await runQuery<{ subject: string; relationship: string; object: string }>(
    `MATCH (a)-[r]->(b)
     RETURN a.name AS subject, type(r) AS relationship, b.name AS object
     LIMIT 20`
  );
  return results;
}

// Write entities extracted from an exchange to Neo4j
export async function writeEntities(
  entities: Array<{ subject: string; relationship: string; object: string }>
): Promise<void> {
  for (const { subject, relationship, object } of entities) {
    await runQuery(
      `MERGE (a:Entity {name: $subject})
       MERGE (b:Entity {name: $object})
       MERGE (a)-[:${relationship}]->(b)`,
      { subject, object }
    );
  }
}
