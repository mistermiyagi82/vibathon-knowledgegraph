# Plan: Seed a realistic week of chat history + Neo4j memory

## Context
The app has real data from today (March 19) but the memory and conversation history feel empty and untested. The goal is to seed 3 realistic chat sessions spanning March 12–18, covering both personal and technical topics, plus populate Neo4j with rich facts about Nathan. This lets us see the full system in action — memory panel, context sources, history retrieval — without waiting weeks for organic data.

## What we know about Nathan (from existing chats)
- Name: Nathan
- Identifies as gay, has someone named Daniel in his life
- Loves chocolate, pasta, quick cooking
- Building this AI companion app (vibathon hackathon)
- Interested in Israel/Middle East news
- Casual, direct tone — uses lowercase, shorthand

---

## Approach

Single script: `scripts/seed.ts`
Run with: `npx tsx scripts/seed.ts`

### Three chats to create

**Chat 1 — "Building this thing" (Wed March 12, ~10 exchanges)**
Nathan starts working on the vibathon project, talks through the architecture with the AI friend, gets into Neo4j setup, mentions the hackathon pressure, is excited and a bit stressed. Technical + personal mix.

**Chat 2 — "Friday night, nothing to do" (Fri March 14, ~6 exchanges)**
End of week wind-down. Mentions Daniel briefly, asks what to cook, gets pasta recipe help, talks about going out or staying in. Casual and personal.

**Chat 3 — "Getting back into it" (Mon March 17, ~8 exchanges)**
Back to building. Debugging the memory system, discussing how the agent should behave, some frustration, some progress. References things from Chat 1 naturally (Claude "remembers").

---

## Neo4j facts to seed

```
Nathan BUILDING vibathon-knowledgegraph-app
Nathan PARTICIPATING_IN vibathon-hackathon
Nathan USES TypeScript
Nathan USES Next.js
Nathan USES Neo4j
Nathan USES Anthropic-Claude-API
Nathan LOVES chocolate
Nathan LIKES pasta
Nathan HAS_FRIEND Daniel
Nathan WORKING_ON AI-companion-app
Nathan BUILDING persistent-memory-system
Nathan USES Cursor-for-coding
Nathan INTERESTED_IN AI-memory-architecture
Nathan DEADLINE vibathon-submission
```

---

## Files to create

| File | Description |
|------|-------------|
| `scripts/seed.ts` | Main seed script |
| `data/chats/{uuid1}/messages.md` | Chat 1 messages |
| `data/chats/{uuid1}/meta.json` | Chat 1 metadata |
| `data/chats/{uuid2}/messages.md` | Chat 2 messages |
| `data/chats/{uuid2}/meta.json` | Chat 2 metadata |
| `data/chats/{uuid3}/messages.md` | Chat 3 messages |
| `data/chats/{uuid3}/meta.json` | Chat 3 metadata |

---

## Script structure

```typescript
// scripts/seed.ts
// 1. Import fs, path, neo4j driver (reuse src/lib/neo4j.ts pattern)
// 2. Define seed chats as structured data (exchanges array per chat)
// 3. For each chat: mkdirSync + writeFileSync messages.md + meta.json
// 4. Connect to Neo4j via env vars, run MERGE queries for each fact
// 5. Close driver, log summary
```

### messages.md format (must match exactly)

```
## {ISO_TIMESTAMP}
<!-- user-id: {uuid} -->
**User:** {content}

<!-- assistant-id: {uuid} -->
**Claude:** {content}
<!-- context: {"graph":[],"history":[],"files":[],"recent":false} -->
```

### meta.json format

```json
{
  "id": "{uuid}",
  "title": "Chat title",
  "createdAt": "{ISO}",
  "updatedAt": "{ISO}",
  "messageCount": 20,
  "lastMessagePreview": "last user message..."
}
```

---

## Critical files to reference

- `src/lib/storage/chats.ts` — exact parsing format (do not break)
- `src/lib/neo4j.ts` — reuse driver pattern
- `src/lib/memory/graph.ts` — reuse `writeEntities()` for Neo4j inserts
- `.env` — NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, DATA_PATH

---

## Verification steps

1. Run `npx tsx scripts/seed.ts` — should log "Seeded 3 chats, N Neo4j facts"
2. Open app at localhost:3001 — 3 new chats appear in the list with correct dates
3. Click into Chat 1 — full conversation visible, dates from March 12
4. Open Memory panel — shows rich facts (chocolate, Daniel, TypeScript, etc.)
5. Click a Claude message → Sources panel → graph facts visible in context
6. Send a new message in Chat 3 — Claude references past conversations naturally
