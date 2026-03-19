# Plan: Attio CRM-Connected Recruiter Agent

## Context
Transform this chat app into a three-party recruitment coordination tool. Each chat is linked to an Attio CRM contact. The agent serves three roles depending on who it's talking to:

- **Candidate-facing:** Guides the candidate through their recruitment journey, helps schedule interviews, answers questions, sends reminders
- **Recruiter-facing (Daniel / Daisy):** Gives recruiters a full picture of the candidate, helps them prepare, handles scheduling coordination
- **Company/client-facing:** Keeps the hiring company informed about candidate status and next steps

The agent reads all data from Attio (candidate profile, company, workflow status) and acts as an intelligent coordinator between all three parties.

Key requirements:
- New chat flow: pick an Attio contact → pick an agent template → start chat
- Per-chat memory (scoped to contact, not global)
- Per-chat system prompt (from template, editable per chat)
- Per-chat agent config (tools, model, settings)
- Agent templates: pre-built configs per party (candidate template, recruiter template, client template)
- Attio MCP integration for contact/company/workflow data
- Google Calendar for scheduling with Daniel & Daisy (Phase 2)
- Email confirmation + WhatsApp reminders (Phase 2)

---

## What's Immediately Buildable vs What Needs External Services

### ✅ Immediately buildable
1. Attio MCP integration (Attio has an official MCP server)
2. Contact picker in new chat flow
3. Per-chat memory scoping
4. Per-chat system prompt & agent config
5. Agent templates system
6. Contact context auto-injected into every message

### 🔧 Needs external setup (out of scope for this plan, flagged for later)
- Google/Microsoft Calendar API (OAuth required) → schedule meetings
- Email sending (Resend/SendGrid) → confirmation emails
- WhatsApp Business API (Twilio) → day-before reminders
- Cron jobs → automated reminders

---

## Architecture Changes

### 1. Extend Chat metadata
**File:** `src/types/index.ts` and `src/lib/storage/chats.ts`

Add to `Chat` interface:
```typescript
contactId?: string        // Attio contact record ID
contactName?: string      // Display name
templateId?: string       // Which template was used
agentConfig?: AgentConfig // Per-chat agent config
```

New `AgentConfig` interface:
```typescript
interface AgentConfig {
  systemPrompt?: string   // Overrides global prompt for this chat
  model?: string          // Model override
  tools?: string[]        // Which tools are enabled
}
```

Store `agentConfig` in `data/chats/{chatId}/meta.json` alongside existing fields.

### 2. Per-chat memory scoping
**File:** `src/lib/memory/graph.ts`

- Add `chat_id TEXT` column to `facts` table (nullable, NULL = global)
- `queryGraphMemory(userMessage, chatId?)` — searches facts scoped to that chatId first, falls back to global
- `writeEntities(entities, chatId?)` — writes facts with chatId attached
- Update `processConversation()` to pass chatId through

**File:** `src/lib/memory/processor.ts`
- Pass `chatId` to `writeEntities()`

### 3. Per-chat system prompt
**File:** `src/lib/prompt.ts`

Update `getSystemPrompt(chatId?)`:
- If chatId provided, check `meta.json` for `agentConfig.systemPrompt`
- If found, use that instead of global prompt
- Still append skills files

**File:** `src/app/api/chats/[chatId]/messages/route.ts`
- Pass `chatId` to `getSystemPrompt(chatId)`

### 4. Agent Templates
**Storage:** `data/templates/{templateId}.json`

```json
{
  "id": "recruiter-v1",
  "name": "Recruiter Agent",
  "description": "Candidate recruitment flow with Attio integration",
  "systemPrompt": "You are a recruiter assistant at ADEO...",
  "model": "claude-sonnet-4-6",
  "tools": ["query_memory", "search_history", "get_attio_contact"]
}
```

**API endpoints:**
- `GET /api/templates` — list all templates
- `GET /api/templates/{id}` — get single template

### 5. Attio MCP Integration
**Setup:** Add Attio MCP server to Claude Code / app MCP config

Attio MCP tools available:
- `attio_get_record` — get full contact record (name, email, phone, notes, custom fields)
- `attio_search_records` — search contacts by name/email
- `attio_get_list_entries` — get candidates in a workflow list with their status
- `attio_update_record` — update status/notes

Add these as tools in `MEMORY_TOOLS` (or a separate `ATTIO_TOOLS` array) for chats that have a contactId.

Auto-inject contact context at the start of every conversation:
- When a chat has a `contactId`, fetch the Attio record on first message
- Inject as a system context block: "Here is everything you know about this candidate: ..."

### 6. New Chat Flow — Contact Picker
**File:** `src/components/landing/LandingPage.tsx`

Replace the simple input → redirect flow with a 3-step modal:

**Step 1: Choose mode**
- "Start as yourself" (current behavior)
- "Start as a candidate chat" (recruiter mode)

**Step 2 (recruiter mode): Pick a contact from Attio**
- Search input → calls `GET /api/attio/contacts?search=...`
- Shows list of matching contacts with name + company
- Select one

**Step 3: Pick a template**
- Grid of available templates
- "Blank" option = no template
- Select → chat is created with contactId + agentConfig from template

**New API endpoints:**
- `GET /api/attio/contacts?search=query` — proxy to Attio MCP, returns contact list
- `POST /api/chats` — extended to accept `{ contactId, contactName, templateId }` body

### 7. Chat title = contact name
**File:** `src/lib/storage/chats.ts` and `src/app/api/chats/route.ts`

When a chat is created with a `contactId`, set the chat `title` to `contactName` immediately (skip the auto-title generation from first message).

---

## File Change Summary

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `AgentConfig`, extend `Chat` with contactId/templateId/agentConfig |
| `src/lib/storage/chats.ts` | `createChat()` accepts optional metadata, `updateChatMeta()` handles agentConfig |
| `src/lib/memory/graph.ts` | Add `chat_id` to facts table, scope queries by chatId |
| `src/lib/memory/processor.ts` | Pass chatId to writeEntities |
| `src/lib/prompt.ts` | `getSystemPrompt(chatId?)` reads per-chat override from meta |
| `src/app/api/chats/route.ts` | Accept contactId/templateId in POST body |
| `src/app/api/chats/[chatId]/messages/route.ts` | Pass chatId to getSystemPrompt, scope memory |
| `src/app/api/templates/route.ts` | NEW — list/read templates |
| `src/app/api/attio/contacts/route.ts` | NEW — proxy Attio contact search |
| `src/components/landing/LandingPage.tsx` | 3-step new chat modal |
| `src/components/landing/ContactPicker.tsx` | NEW — Attio contact search UI |
| `src/components/landing/TemplatePicker.tsx` | NEW — template grid UI |
| `data/templates/recruiter.json` | NEW — recruiter template |

---

## Attio MCP Setup Required
- User has a separate Attio API key (not STITCH_API_KEY)
- Add `ATTIO_API_KEY=...` to `.env` and Railway environment variables
- Attio MCP server: use their REST API directly in route handlers (no separate MCP server process needed for this app — just HTTP calls to `https://api.attio.com/v2/`)
- Key endpoints needed:
  - `GET /v2/objects/people/records?filter=...` — search contacts
  - `GET /v2/objects/people/records/{id}` — get full contact
  - `GET /v2/objects/companies/records/{id}` — get company info
  - `GET /v2/lists/{listId}/entries` — get workflow entries + status

## Google Calendar Integration (Phase 2)
- Needs Google OAuth2 for Daniel & Daisy's calendars
- Flagged for after foundation is built
- Will use `googleapis` npm package
- For now: agent can ask "when are you available?" and manually coordinate

---

## Recruiter System Prompt Template (starter)
```
You are a recruiter assistant at ADEO. You are chatting directly with a candidate.

You have full access to this candidate's profile in Attio — their experience, the role they're applying for, and their current status in our recruitment workflow.

Your job:
- Be warm, professional, and human
- Guide the candidate through their next step based on their current status
- When they need to schedule something with Daniel or Daisy, check availability and propose times
- Confirm appointments and send reminders

Candidate context will be injected below at the start of each conversation.
```

---

## Verification
1. Create a new chat — 3-step modal appears
2. Search for a contact in Attio — results appear
3. Pick template — chat opens with correct system prompt
4. Send a message — agent sees candidate context, responds as recruiter
5. Memory from this chat stays scoped to this contact only
6. Open a different contact chat — different memory, different system prompt
