# PRD — Persistent Memory Chat

## 1. Overview

A single-user web chat application that converses with Claude. The system builds persistent memory across all sessions using MD files for raw history and a Neo4j Aura knowledge graph for structured facts. Every response is traceable — the user can inspect exactly what memory, files, or past conversations any given reply was based on.

---

## 2. Users

Single user. No authentication required. No multi-tenancy.

---

## 3. Functional Features

### 3.1 Landing Page

User arrives at the URL and sees a full-screen minimal page:

- **Headline** — a warm greeting at the top, e.g. *"Hey, what do you want to chat about today?"* — large, thin font weight
- **Logo or wordmark** — small, top area, very light and minimal
- **Input field** — auto-focused on page load, no visible border or background, just a blinking cursor. User can type immediately without clicking anything. A send button sits to the right of the input.
- Typing in this field and submitting creates a new chat and navigates directly into it
- **Recent chats list** — below the input, sorted chronologically with most recent at top
  - Each row: chat title + last message preview (truncated) + timestamp (right-aligned)
  - No cards, no borders — clean rows with generous spacing
  - Clicking a row navigates to that chat
- Chat titles are auto-generated from the first user message (Claude summarizes in 4–5 words)
- If no past chats exist, the list is hidden — only the headline and input are shown
- Built as a swappable component (`/app/page.tsx`)

### 3.2 Chat View

Ultra-minimal layout. The interface disappears — only the conversation is visible.

- **Top-left menu button** — a single small icon (hamburger or grid), the only persistent chrome element. Opens a navigation overlay: back to landing page, list of recent chats. Fades to near-invisible when idle, full opacity on hover.
- No header bar, no chat title bar, no back arrow — navigation lives entirely in the menu button
- Newest messages at the **bottom**, scroll up for older messages — infinite history, no pagination
- Date separators: centered muted text only (e.g. *Mar 15*), no lines or dividers
- **User messages**: right-aligned white card with a very subtle shadow. When sent, animates in from the bottom — fast upward spring (~180ms, ~20px travel). Timestamp appears on hover only, small and muted.
- **Claude messages**: no bubble, no card — plain prose text left-aligned directly on the background, slightly indented. Streams token by token with a soft blinking cursor at the end. Timestamp on hover only.
- **File attachments**: inline pill inside the message — filename + download arrow. Click to download.
- Clicking a Claude message selects it and updates the sidebar to show its context sources
- **Input area** fixed to the bottom — no border, no background. Just a blinking cursor and placeholder *"Ask anything..."*. Auto-focused when chat opens.
- **+ button** on the left of input — opens file picker
- **Send button** on the right — minimal arrow `→`, activates on Enter or click
- When a file is attached before sending: a small pill appears above the input showing filename with × to remove
- Empty new chat: completely blank except the menu button and the input. No instructions, no placeholder art.
- Built as a swappable component (`/app/chat/[chatId]/page.tsx`)

### 3.3 File Upload

- **+** button on the left side of the input field — opens file picker
- Supported types: PDF, PNG, JPG, WebP, plain text
- Before sending: file previews as a small pill above the input (`design-spec.pdf ×`) — × removes it
- After sending: file appears as an inline pill inside the message bubble (`design-spec.pdf ↓`)
- File is sent to Claude as part of that message (Claude actually reads/sees the content)
- Clicking any file attachment in chat immediately downloads the file
- File viewer (in-browser preview) is out of scope for v1 — download only

### 3.4 Memory System

Three layers of memory injected into every Claude prompt:

**Layer 1 — Recent history**
Last 10 messages from the current chat. Always included.

**Layer 2 — Semantic retrieval**
Keyword/topic search over all past chat MD files across all sessions. Finds relevant past exchanges even from months ago. Top 3–5 relevant excerpts included.

**Layer 3 — Knowledge graph**
Neo4j Aura queried for entities and relationships relevant to the current message. Returns structured facts about the user, topics, decisions, and files.

Memory spans **all chats** — Claude's knowledge is global, not scoped to a single session.

### 3.5 Entity Extraction

After every Claude response, a second API call extracts entities and relationships from the exchange and writes them to Neo4j. Examples:

- `(User)-[:PREFERS]->(TypeScript)`
- `(User)-[:BUILDING]->(PaymentAPI)`
- `(PaymentAPI)-[:USES]->(JWT)`
- `(File:design-spec.pdf)-[:UPLOADED_ON]->(2026-03-19)`
- `(File:design-spec.pdf)-[:DESCRIBES]->(PaymentFlow)`

### 3.6 Sidebar — Memory Overview (default state)

Always visible on the right side of the chat view. Same background as the page — no visible border separating it from the chat, only content alignment creates the division. When no message is selected, shows:

- **What I know** — 3–5 entity tags as minimal text pills (e.g. `TypeScript` · `Payment API` · `JWT`)
- **Files** — list of all uploaded files across all chats, with dates, clickable to download
- **Sessions** — one line of stats: *12 conversations · Since Mar 10*
- If no memory exists yet, the sidebar is empty — no placeholder text

### 3.7 Sidebar — Context View (message selected)

Clicking any Claude message switches the sidebar to show what that specific response was based on:

- Small muted label: *"Based on"*
- **From memory graph** — 2–3 facts as plain readable sentences (not raw graph notation)
- **From file** — filename + 1-line excerpt
- **From past conversations** — short quote with chat title and date
- Each source has a subtle thin left accent line (muted violet / amber / blue)
- Transition: gentle crossfade, 150ms

Clicking anywhere else or pressing Escape returns to memory overview with a crossfade.

Only Claude messages are clickable for context. User messages are not.

### 3.8 `/memory` Command

User types `/memory` in the chat input. Claude responds with a natural language summary of everything it currently knows about the user and past conversations, drawn from the graph and summary.md.

### 3.9 Conversation Persistence

- All messages appended to `messages.md` per chat with ISO timestamp
- File structure per message:

```
## 2026-03-19T10:32:14Z
**User:** message text
[file: design-spec.pdf](../../uploads/{chatId}/design-spec.pdf)

**Claude:** response text
[context: {"graph": [...], "history": [...], "files": [...]}]
```

- On chat load, full MD history is read and rendered into the thread
- `summary.md` maintained globally — a running high-level summary of topics discussed across all chats, updated after each response

---

## 4. Technical Features

### 4.1 Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API routes (same repo) |
| LLM | Claude via Anthropic API, streaming |
| Knowledge graph | Neo4j Aura free tier |
| Graph client | LangChain.js Neo4j integration |
| File storage | Railway persistent volume |
| History storage | MD files on Railway persistent volume |
| Hosting | Railway |

### 4.2 API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/chats` | GET | List all chats for landing page |
| `/api/chats` | POST | Create new chat, return chatId |
| `/api/chats/:chatId` | GET | Load full message history for a chat |
| `/api/chats/:chatId/messages` | POST | Send message, stream Claude response |
| `/api/context/:messageId` | GET | Return context used for a specific message |
| `/api/memory` | GET | Return current graph state for sidebar overview |
| `/api/upload/:chatId` | POST | Upload file, store on volume, return reference |

### 4.3 Claude Prompt Structure

Every call to Claude is built as:

```
[System]
You are a persistent assistant with long-term memory.
You have an ongoing relationship with this user.
Speak from memory naturally — not as if reading a database.

[Memory — Graph Facts]
Here is what you know about the user and past topics:
{graph query results}

[Memory — Relevant Past]
Relevant excerpts from past conversations:
{semantic search results}

[Memory — Recent]
Recent messages from this chat:
{last 10 messages}

[User message]
{current message + any file attachments}
```

### 4.4 Post-Processing (after each response)

Two operations run in parallel after Claude responds:

1. **Append to MD** — full exchange with timestamp and context JSON written to `messages.md`
2. **Entity extraction** — second Claude call: *"Extract all entities, facts, and relationships from this exchange as JSON"* → written to Neo4j

### 4.5 File Handling

- Files stored at `/data/uploads/{chatId}/filename`
- Metadata stored in Neo4j as a File node: name, path, chatId, upload date, type, extracted topics
- When a file is referenced in a Claude response, the messageId is linked to the File node in Neo4j so the sidebar can surface it
- File download: each attachment rendered as `<a href="/api/files/{chatId}/filename" download>`

### 4.6 Semantic Search

- v1: keyword matching over all past MD files
- v2 (future): replace with vector embeddings stored in Neo4j vector index

### 4.7 Streaming

- Claude response streamed via Server-Sent Events (SSE)
- Frontend renders tokens as they arrive
- Sidebar context panel populated once stream completes

### 4.8 Context Tracking Per Message

- Each Claude message assigned a unique `messageId` (UUID)
- At response time, the context object `{graph, history, files, recent}` stored in MD alongside the message
- `/api/context/:messageId` reads this and returns it to the sidebar on click

### 4.9 Chat Title Generation

- After the first user message in a new chat, a separate Claude call generates a 4–5 word title
- Title written to `meta.json` for that chat
- Displayed on the landing page chat list and in the navigation menu — not in a chat header bar

---

## 5. Data Model

### Filesystem layout

```
/data/
  chats/
    {chatId}/
      messages.md       ← full message history for this chat
      meta.json         ← title, created date, last message date, messageCount
  uploads/
    {chatId}/
      filename.pdf
  summary.md            ← global running summary across all chats
```

### meta.json per chat

```json
{
  "id": "abc123",
  "title": "Payment API architecture",
  "createdAt": "2026-03-19T10:32:14Z",
  "updatedAt": "2026-03-19T11:45:00Z",
  "messageCount": 24
}
```

### Neo4j graph

**Node types:** `User`, `Topic`, `Decision`, `File`, `Session`, `Entity`

**Relationship types:**
`PREFERS`, `BUILDING`, `DECIDED`, `UPLOADED`, `DESCRIBES`, `DISCUSSED_IN`, `PART_OF`, `USES`, `KNOWS_ABOUT`

---

## 6. UI/UX

### Visual style
- Light, airy, ultra-minimal — warm off-white background (`#f9f9f7`), near-black text
- Single accent color for interactive elements — dark (`#1a1a1a`)
- No dark mode, no heavy color usage, near-monochrome throughout
- No borders unless absolutely required, no shadows except the most subtle
- Font: Inter or Geist, light weights, generous line height

### Layout rules
- Landing page and chat view are isolated as swappable components (`/app/page.tsx`, `/app/chat/[chatId]/page.tsx`)
- Tailwind CSS only — no opinionated component library
- Sidebar always visible in chat view, never collapses, no toggle
- Desktop only (v1), minimum 1280px width

### Interaction rules
- All input fields auto-focused on page load
- Timestamps visible on hover only — not always rendered
- Message send animation: user message slides up ~20px and fades in, ~180ms spring
- Streaming: blinking cursor at end of Claude response while tokens arrive
- After entity extraction completes: *"Memory updated"* fades in at bottom of sidebar, disappears after 2 seconds
- Menu button fades to near-invisible when idle
- No heavy animations — 150–200ms max on all transitions

---

## 7. Environment Variables

```
ANTHROPIC_API_KEY
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
DATA_PATH=/data
```

---

## 8. Hosting

- **App**: Railway, single service, Node.js buildpack
- **Volume**: Railway persistent volume mounted at `/data`
- **Graph**: Neo4j Aura free tier (external, always on, survives redeploys)

---

## 9. Out of Scope (v1)

- Authentication / login
- Multiple users
- Rename / delete chat
- In-browser file viewer
- Vector embeddings for semantic search
- Mobile responsive layout
- Chat search across sessions
- Export conversation
