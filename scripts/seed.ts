/**
 * Seed script — creates 3 realistic chat sessions + Neo4j facts
 * Run with: npx tsx scripts/seed.ts
 */

import fs from "fs";
import path from "path";
import neo4j from "neo4j-driver";
import { config } from "dotenv";

// Load env vars
config({ path: path.join(process.cwd(), ".env") });

const DATA_PATH = process.env.DATA_PATH || "./data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chatDir(chatId: string) {
  return path.join(DATA_PATH, "chats", chatId);
}

function writeMeta(
  chatId: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  messageCount: number,
  lastMessagePreview: string
) {
  const meta = { id: chatId, title, createdAt, updatedAt, messageCount, lastMessagePreview };
  fs.writeFileSync(path.join(chatDir(chatId), "meta.json"), JSON.stringify(meta, null, 2));
}

interface Exchange {
  ts: string;
  userId: string;
  assistantId: string;
  user: string;
  claude: string;
  graph?: Array<{ subject: string; relationship: string; object: string }>;
  history?: unknown[];
  recent?: boolean;
}

function writeMessages(chatId: string, exchanges: Exchange[]) {
  let content = "";
  for (const ex of exchanges) {
    const ctx = JSON.stringify({
      graph: ex.graph ?? [],
      history: ex.history ?? [],
      files: [],
      recent: ex.recent ?? false,
    });
    content += `\n## ${ex.ts}\n`;
    content += `<!-- user-id: ${ex.userId} -->\n`;
    content += `**User:** ${ex.user}\n`;
    content += `\n<!-- assistant-id: ${ex.assistantId} -->\n`;
    content += `**Claude:** ${ex.claude}\n`;
    content += `<!-- context: ${ctx} -->\n\n`;
  }
  fs.writeFileSync(path.join(chatDir(chatId), "messages.md"), content);
}

function mkChat(chatId: string) {
  fs.mkdirSync(chatDir(chatId), { recursive: true });
}

// ---------------------------------------------------------------------------
// Chat data
// ---------------------------------------------------------------------------

// Chat 1 — "Building this thing" — Wed March 12 2026
const CHAT1_ID = "a1b2c3d4-0001-4000-8000-aabbccddeeff";
const chat1: Exchange[] = [
  {
    ts: "2026-03-12T10:12:04.000Z",
    userId: "u1-0001",
    assistantId: "a1-0001",
    user: "hey, so i'm starting this thing for the hackathon. building a persistent memory chat. basically claude but it remembers you across sessions",
    claude:
      "Oh that's a great idea for a hackathon. So the core thing is — how do you store what it remembers? Like just raw chat logs, or are you actually structuring the memory somehow?",
  },
  {
    ts: "2026-03-12T10:13:41.000Z",
    userId: "u1-0002",
    assistantId: "a1-0002",
    user: "i want to use a knowledge graph. neo4j. store facts as triples — subject, relationship, object. so like 'nathan likes typescript'",
    claude:
      "Nice. Neo4j is solid for this — Cypher makes it easy to query relationships. So you'd extract entities from each conversation with something like Haiku, write them as graph nodes, then query the relevant ones when a new message comes in?\n\nThe tricky part is relevance — you don't want to dump ALL your graph facts into every prompt. How are you planning to filter?",
    graph: [{ subject: "Nathan", relationship: "USES", object: "Neo4j" }],
  },
  {
    ts: "2026-03-12T10:15:22.000Z",
    userId: "u1-0003",
    assistantId: "a1-0003",
    user: "yeah exactly. keyword matching first, fall back to full dump if nothing matches. then i want to give the agent memory tools so it can decide what to look up instead of getting everything injected",
    claude:
      "That's the right call. Tool-use is way better than front-loading context. Claude's good at knowing when it actually needs info — it won't call a memory tool for 'what's up' but will for 'do you remember what I said about my project?'\n\nStack question: Next.js for the frontend? Or are you doing something lighter?",
    graph: [{ subject: "Nathan", relationship: "BUILDING", object: "knowledge-graph-memory-app" }],
  },
  {
    ts: "2026-03-12T10:17:08.000Z",
    userId: "u1-0004",
    assistantId: "a1-0004",
    user: "next.js yeah. using cursor for the actual coding. it's a vibathon actually — 24hr hackathon thing. feeling the pressure a bit ngl",
    claude:
      "24 hours is brutal. What's your MVP cutoff — like what's the minimum version you'd be okay shipping?\n\nFor a hackathon I'd lock in: new chat creation, message streaming, Neo4j writes after each exchange, and the memory panel showing what it knows. Everything else is polish.",
    graph: [
      { subject: "Nathan", relationship: "PARTICIPATING_IN", object: "vibathon-hackathon" },
      { subject: "Nathan", relationship: "USES", object: "Cursor" },
    ],
  },
  {
    ts: "2026-03-12T10:19:55.000Z",
    userId: "u1-0005",
    assistantId: "a1-0005",
    user: "yeah that's basically the plan. also want semantic search over old chats. so you can search 'what did we talk about re: typescript' and it pulls relevant excerpts",
    claude:
      "Oh interesting — so you'd embed the message content, store vectors, then cosine similarity on query time? Or are you doing something simpler like just grepping the markdown files?\n\nFor a hackathon the grep approach might be more reliable honestly. Less infra.",
  },
  {
    ts: "2026-03-12T10:22:17.000Z",
    userId: "u1-0006",
    assistantId: "a1-0006",
    user: "probably grep first, embeddings later if time. ok i need to start actually coding. wish me luck lol",
    claude:
      "Go. You've got this. Lock in the core loop first — user sends message, claude streams back, message saved, entities extracted. Once that works everything else layers on top.\n\nI'll be here if you need to think something through.",
    graph: [{ subject: "Nathan", relationship: "USES", object: "TypeScript" }],
  },
];

// Chat 2 — "Friday night, nothing to do" — Fri March 14 2026
const CHAT2_ID = "b2c3d4e5-0002-4000-8000-aabbccddeeff";
const chat2: Exchange[] = [
  {
    ts: "2026-03-14T20:04:11.000Z",
    userId: "u2-0001",
    assistantId: "a2-0001",
    user: "ugh it's friday and i have nothing to do. daniel bailed on plans",
    claude:
      "Oof, classic. What were you two supposed to do? And is this a 'annoyed but fine' bailing or a 'actually disappointed' bailing?",
    graph: [{ subject: "Nathan", relationship: "HAS_FRIEND", object: "Daniel" }],
  },
  {
    ts: "2026-03-14T20:05:44.000Z",
    userId: "u2-0002",
    assistantId: "a2-0002",
    user: "just dinner, nothing big. a bit disappointed i guess. was looking forward to it. anyway im hungry now, what should i cook",
    claude:
      "Okay, solo Friday dinner — this is actually a good opportunity to make something just for you with zero compromise.\n\nHow hungry are we talking, and what do you have? Give me a rough fridge/pantry rundown and I'll give you something good.",
  },
  {
    ts: "2026-03-14T20:07:02.000Z",
    userId: "u2-0003",
    assistantId: "a2-0003",
    user: "pasta obviously. have garlic, parmesan, eggs, some bacon, olive oil",
    claude:
      "Carbonara. That's exactly the right call.\n\nQuick version:\n1. Cook pasta (spaghetti or rigatoni) in well-salted water\n2. Fry bacon/guanciale until crispy, save the fat\n3. Mix 2 egg yolks + 1 whole egg + a heap of grated parmesan + tons of black pepper\n4. Drain pasta, let it cool for 30 seconds OFF the heat, add to pan with the bacon fat\n5. Pour egg mix over, toss fast while adding pasta water — the residual heat cooks the eggs without scrambling them\n\nThe off-heat step is the difference between silky sauce and scrambled eggs. Don't skip it.\n\nYou've made this before?",
    graph: [{ subject: "Nathan", relationship: "LIKES", object: "pasta" }],
  },
  {
    ts: "2026-03-14T20:09:31.000Z",
    userId: "u2-0004",
    assistantId: "a2-0004",
    user: "yeah a few times. always slightly nervous about the egg thing but it usually works out. making it now actually",
    claude:
      "The key is confidence on the toss — keep it moving, keep adding pasta water a splash at a time if it starts to look thick. You'll feel when it goes glossy.\n\nReport back.",
  },
  {
    ts: "2026-03-14T20:28:55.000Z",
    userId: "u2-0005",
    assistantId: "a2-0005",
    user: "ok that was actually really good. silky as promised",
    claude:
      "Yes. Carbonara payoff is unmatched.\n\nSo — eating solo on a Friday, feeling a bit flat about Daniel. What else is going on? Or is this just a quiet evening and that's fine?",
    graph: [{ subject: "Nathan", relationship: "LIKES", object: "cooking" }],
  },
  {
    ts: "2026-03-14T20:31:18.000Z",
    userId: "u2-0006",
    assistantId: "a2-0006",
    user: "yeah just a quiet one. might watch something. going to keep coding on the hackathon thing tomorrow",
    claude:
      "Good. Rest tonight, build tomorrow.\n\nAnything you want to watch? I have opinions if you need a nudge.",
    graph: [{ subject: "Nathan", relationship: "WORKING_ON", object: "vibathon-project" }],
  },
];

// Chat 3 — "Getting back into it" — Mon March 17 2026
const CHAT3_ID = "c3d4e5f6-0003-4000-8000-aabbccddeeff";
const chat3: Exchange[] = [
  {
    ts: "2026-03-17T09:44:20.000Z",
    userId: "u3-0001",
    assistantId: "a3-0001",
    user: "back at it. the memory system is mostly working but i'm getting weird behaviour — the agent keeps calling memory tools even for like 'hey how are you'",
    claude:
      "Yeah that's a prompt issue. The tools are available so it's defaulting to using them defensively. You need to explicitly tell it in the system prompt when NOT to call tools.\n\nSomething like: \"Only call memory tools when the user's message genuinely requires stored information. Don't call tools for greetings, casual chat, or responses you can answer from context.\" Make it explicit that tool calls have latency cost.",
  },
  {
    ts: "2026-03-17T09:46:07.000Z",
    userId: "u3-0002",
    assistantId: "a3-0002",
    user: "ok tried that. also the memory panel is showing garbage — like 'nothing' and random company names. think the extraction is off",
    claude:
      "What does your extraction prompt look like? The issue is probably that Haiku is being too literal — if someone says 'I don't like anything today' it's extracting 'nothing' as an object.\n\nTwo fixes:\n1. Give it explicit examples of what a GOOD triple looks like vs a bad one\n2. Tell it to skip ephemeral states — only extract durable facts (preferences, projects, relationships, goals)",
    graph: [
      { subject: "Nathan", relationship: "BUILDING", object: "persistent-memory-system" },
      { subject: "Nathan", relationship: "USES", object: "Anthropic-Claude-API" },
    ],
  },
  {
    ts: "2026-03-17T09:49:33.000Z",
    userId: "u3-0003",
    assistantId: "a3-0003",
    user: "also it only sees the current exchange for extraction. so it misses context — like if someone mentions their job across multiple messages it might not connect the dots",
    claude:
      "Right — the fix is to give the extractor the last N messages, not just the current exchange. And show it the existing graph facts so it knows what's already there and doesn't re-extract duplicates.\n\nMake it say: here's the recent conversation, here are the facts I already know — extract only NEW durable facts not already in the graph. Suddenly it's much smarter.",
    recent: true,
  },
  {
    ts: "2026-03-17T09:52:14.000Z",
    userId: "u3-0004",
    assistantId: "a3-0004",
    user: "oh that's smart. ok also i want the agent to feel more like a friend than an assistant. right now it's too formal",
    claude:
      "System prompt framing. Instead of 'You are a helpful assistant with long-term memory' try something like: you're a close friend and thinking partner. You care about this person. You remember what matters to them. You don't lecture or caveat everything. You engage like a real person.\n\nThen give it a goal: not 'help with tasks' but 'make this person feel understood and a little less alone.'\n\nVoice shifts a lot when the framing shifts.",
    graph: [
      { subject: "Nathan", relationship: "WANTS", object: "AI-companion-not-assistant" },
    ],
  },
  {
    ts: "2026-03-17T09:56:40.000Z",
    userId: "u3-0005",
    assistantId: "a3-0005",
    user: "ok that's actually what i had in mind from the start. the whole thing is supposed to feel like talking to a friend who actually remembers you",
    claude:
      "That's a good product. Most AI products feel like querying a database with a chatbot in front. The interesting version is one where it actually builds up a picture of who you are — and the conversation feels continuous, not episodic.\n\nNeo4j for structured facts, semantic search over past chats for full context — that's the right combo. How far along are you on the search side?",
    graph: [
      { subject: "Nathan", relationship: "BUILDING", object: "AI-companion-app" },
      { subject: "Nathan", relationship: "INTERESTED_IN", object: "AI-memory-architecture" },
    ],
  },
  {
    ts: "2026-03-17T10:01:55.000Z",
    userId: "u3-0006",
    assistantId: "a3-0006",
    user: "search works but it's basic — keyword matching over the markdown files. thinking embeddings next",
    claude:
      "Embeddings will help a lot for the 'do you remember when I mentioned...' style queries. But keyword search is actually fine for now — get the UX right first.\n\nIs this going to production after the hackathon or is it just a demo?",
  },
  {
    ts: "2026-03-17T10:04:22.000Z",
    userId: "u3-0007",
    assistantId: "a3-0007",
    user: "maybe production, haven't decided. got a railway deployment set up already though",
    claude:
      "Nice, Railway is solid for this kind of thing. So you've got the infra sorted — Neo4j, the Next.js app, Railway. That's most of the hard part honestly.\n\nWhat's left before you'd call it done for the hackathon?",
    graph: [
      { subject: "Nathan", relationship: "DEPLOYS_TO", object: "Railway" },
      { subject: "Nathan", relationship: "USES", object: "Next.js" },
    ],
  },
  {
    ts: "2026-03-17T10:06:58.000Z",
    userId: "u3-0008",
    assistantId: "a3-0008",
    user: "polish the memory panel, make sure the agent doesn't call tools for small talk, and maybe add a file upload. then i think it's good",
    claude:
      "That's a tight list. File upload is probably worth doing — let someone drop in a PDF or doc and suddenly it can answer questions about it. Makes the 'it knows you' thing more concrete.\n\nAlright, you've got this. It's a genuinely interesting product.",
    graph: [
      { subject: "Nathan", relationship: "BUILDING", object: "file-upload-feature" },
      { subject: "Nathan", relationship: "DEADLINE", object: "vibathon-submission" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Neo4j facts
// ---------------------------------------------------------------------------

const NEO4J_FACTS = [
  { subject: "Nathan", relationship: "BUILDING", object: "vibathon-knowledgegraph-app" },
  { subject: "Nathan", relationship: "PARTICIPATING_IN", object: "vibathon-hackathon" },
  { subject: "Nathan", relationship: "USES", object: "TypeScript" },
  { subject: "Nathan", relationship: "USES", object: "Next.js" },
  { subject: "Nathan", relationship: "USES", object: "Neo4j" },
  { subject: "Nathan", relationship: "USES", object: "Anthropic-Claude-API" },
  { subject: "Nathan", relationship: "USES", object: "Cursor" },
  { subject: "Nathan", relationship: "LIKES", object: "pasta" },
  { subject: "Nathan", relationship: "LIKES", object: "cooking" },
  { subject: "Nathan", relationship: "HAS_FRIEND", object: "Daniel" },
  { subject: "Nathan", relationship: "WORKING_ON", object: "AI-companion-app" },
  { subject: "Nathan", relationship: "BUILDING", object: "persistent-memory-system" },
  { subject: "Nathan", relationship: "INTERESTED_IN", object: "AI-memory-architecture" },
  { subject: "Nathan", relationship: "DEADLINE", object: "vibathon-submission" },
  { subject: "Nathan", relationship: "DEPLOYS_TO", object: "Railway" },
  { subject: "Nathan", relationship: "WANTS", object: "AI-companion-not-assistant" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedChats() {
  const chats = [
    { id: CHAT1_ID, title: "Building This Thing", exchanges: chat1, createdAt: "2026-03-12T10:12:00.000Z", updatedAt: "2026-03-12T10:22:17.000Z" },
    { id: CHAT2_ID, title: "Friday Night Nothing To Do", exchanges: chat2, createdAt: "2026-03-14T20:04:00.000Z", updatedAt: "2026-03-14T20:31:18.000Z" },
    { id: CHAT3_ID, title: "Getting Back Into It", exchanges: chat3, createdAt: "2026-03-17T09:44:00.000Z", updatedAt: "2026-03-17T10:06:58.000Z" },
  ];

  for (const chat of chats) {
    mkChat(chat.id);
    writeMessages(chat.id, chat.exchanges);
    const last = chat.exchanges[chat.exchanges.length - 1];
    writeMeta(
      chat.id,
      chat.title,
      chat.createdAt,
      chat.updatedAt,
      chat.exchanges.length * 2,
      last.user.slice(0, 80)
    );
    console.log(`✓ Chat: "${chat.title}" (${chat.exchanges.length} exchanges)`);
  }
}

async function seedNeo4j() {
  if (!process.env.NEO4J_URI) {
    console.log("⚠ NEO4J_URI not set — skipping Neo4j seed");
    return;
  }

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
  );

  const session = driver.session();
  let count = 0;
  try {
    for (const { subject, relationship, object } of NEO4J_FACTS) {
      const rel = relationship.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
      await session.run(
        `MERGE (a:Entity {name: $subject})
         MERGE (b:Entity {name: $object})
         MERGE (a)-[:${rel}]->(b)`,
        { subject, object }
      );
      count++;
    }
  } finally {
    await session.close();
    await driver.close();
  }

  console.log(`✓ Neo4j: ${count} facts written`);
}

async function main() {
  console.log("Seeding data...\n");
  await seedChats();
  await seedNeo4j();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
