# What We Built — Implementation Log

A running record of every architectural decision and feature added to this project, with enough detail to understand how each thing works.

---

## Agent Architecture (Change 1, 2, 3)

### Change 1 — Targeted Graph Queries
**File:** `src/lib/memory/graph.ts`

Previously `queryGraphMemory()` ignored the user's message and returned 20 random Neo4j facts. Now it extracts keywords from the message and runs a targeted Cypher query — only returning facts where an entity name matches one of those keywords. Falls back to a full dump if no keywords match.

### Change 2 — Tool-Use Agent
**Files:** `src/lib/anthropic.ts`, `src/app/api/chats/[chatId]/messages/route.ts`, `src/components/chat/ChatView.tsx`

Previously: all memory (graph facts, history excerpts, recent messages) was injected into one fat prompt before Claude saw the message. Claude had no choice in what it received.

Now: Claude gets memory tools and decides what to look up. The route runs a streaming tool-use loop — stream starts immediately, tool calls are detected mid-stream, tools execute, then Claude streams its final response. No blocking Phase 1.

Tools available to Claude:
- `query_memory(question)` — targeted Neo4j lookup
- `search_history(query)` — keyword search across past chats
- `get_recent_messages()` — last 10 messages from current chat
- `get_chat_history(offset, limit)` — messages from any position (see below)

Claude only calls tools when it genuinely needs stored information — not for casual conversation.

### Change 3 — Conversation Memory Builder
**File:** `src/lib/memory/processor.ts`

Previously: `extractEntities()` ran after each message exchange with a tiny 512-token Haiku call that only saw the current exchange.

Now: `processConversation()` sees the last 20 messages for full context AND the existing graph facts (so it doesn't re-add what's already there). It focuses on durable facts worth keeping long-term — preferences, projects, decisions, goals — and skips ephemeral chatter.

---

## Chronological Message Retrieval
**Files:** `src/lib/memory/recent.ts`, `src/lib/anthropic.ts`, `src/app/api/chats/[chatId]/messages/route.ts`

**Problem:** `get_recent_messages` only returns the last 10 messages. Claude could not answer "what was the first thing I said?" because there was no tool to retrieve messages by position.

**Fix:** Added `getMessages(chatId, offset, limit)` to `recent.ts` and a `get_chat_history` tool. Claude can now say "give me the first 10 messages" (offset=0) or "give me messages starting 20 from the end" (offset=-20). The tool is described clearly enough that Claude uses it correctly when someone asks about early parts of a conversation.

---

## File Contents Injection
**Files:** `src/lib/storage/files.ts`, `src/app/api/chats/[chatId]/messages/route.ts`

**Problem:** Files uploaded to a chat were saved to disk and shown in the memory panel, but Claude never actually saw their contents. It would say "I don't have access to that file."

**Fix:** Added `listChatFiles(chatId)` and `readFileContents(chatId, filename, maxBytes)` to `files.ts`. On every message, the route reads all text files uploaded to the current chat and injects their contents into the user's message before Claude sees it.

Supported file types: `.txt`, `.md`, `.csv`, `.json`, `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.html`, `.css`, `.xml`, `.yaml`, `.yml`, `.sh`, `.sql`

PDFs and images: saved and shown in sidebar but contents not yet injected.

---

## Agent Goal / System Prompt
**File:** `src/lib/anthropic.ts`

The agent was originally described as "a persistent assistant with long-term memory." It had no goal.

New framing: a close friend and thinking partner. The system prompt defines when to use memory tools (only when genuinely needed — not for small talk), how to speak (like a real person, not a database), and what success looks like (the person feels understood, helped, a little less alone).

---

## Memory Panel Display Fix
**File:** `src/components/chat/MemoryModal.tsx`

Previously showed only `f.object || f.subject` as pills — so "user PREFERS TypeScript" displayed as just "TypeScript", and "user DISCUSSED nothing" displayed as "nothing".

Now shows the full triple: subject (if not "user") + relationship (dimmed, lowercase) + object. Readable at a glance.

---

## Message Storage Format

Every chat is stored as two files in `data/chats/{chatId}/`:

**`meta.json`** — chat metadata:
```json
{
  "id": "uuid",
  "title": "Chat title",
  "createdAt": "2026-03-12T10:00:00Z",
  "updatedAt": "2026-03-12T10:00:00Z",
  "messageCount": 10,
  "lastMessagePreview": "last thing the user typed"
}
```

**`messages.md`** — full conversation history as markdown:
```markdown
## 2026-03-12T10:00:00Z
<!-- user-id: uuid -->
**User:** what the user said

<!-- assistant-id: uuid -->
**Claude:** what the agent responded
<!-- context: {"graph":[...],"history":[...],"files":[],"recent":true} -->
```

Each exchange is a markdown block starting with a timestamp header. User and assistant messages are separated by HTML comments containing UUIDs. After the assistant message, a hidden HTML comment stores the full context JSON — what memory sources were used. This is what the "Sources" panel reads when you click a message.
