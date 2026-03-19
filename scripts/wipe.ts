import neo4j from "neo4j-driver";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env") });

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
  );
  const session = driver.session();
  await session.run("MATCH (n) DETACH DELETE n");
  console.log("Neo4j wiped");
  await session.close();
  await driver.close();
}

main().catch(console.error);
