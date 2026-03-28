# Plan: Vercel AI SDK Migration + MCP + Generative UI Charts

## Context
The app currently uses direct Anthropic/OpenAI SDK calls with a custom SSE streaming route and a hand-rolled tool dispatcher. The goal is to:
1. Migrate to Vercel AI SDK (native MCP support, tool invocation rendering, better streaming primitives)
2. Connect the VVD MCP server (per-chat configurable via HTTP URL)
3. Render VVD tool results as inline Recharts components in the chat

---

## New packages
```
npm install ai @ai-sdk/anthropic @ai-sdk/openai recharts zod
```
- `ai` — Vercel AI SDK core (`streamText`, `useChat`, `createMCPClient`)
- `@ai-sdk/anthropic` — Claude provider
- `@ai-sdk/openai` — OpenAI + Groq (via `createOpenAI({ baseURL })`)
- `recharts` — React chart library
- `zod` — Tool parameter schemas

---

## Architecture after migration

```
Client: useChat (ai/react)
  → POST /api/chats/[chatId]/messages  { messages: [...], model }

Server: streamText (ai)
  ├── Provider: anthropic() | openai() | createOpenAI(groq)
  ├── tools: Zod-defined local tools + MCP tools
  │     ├── query_memory, search_history, grep_history, ...
  │     └── vvd_actuals_summary, vvd_forecast_summary, ...
  ├── onFinish: persist messages, graphiti ingest, memory process
  └── .toDataStreamResponse()

Client: messages[].toolInvocations
  └── toolName starts with "vvd_" → render <VVDChart />
```

---

## Files to change

### 1. `src/app/api/chats/[chatId]/messages/route.ts` — Full rewrite
- Accept `{ messages, model }` from `useChat`
- Build `systemPrompt` the same way (agentConfig, contact injection, files)
- Use `streamText({ model, system, messages, tools, maxSteps: 5 })`
- **Model selection**:
  - `anthropic("claude-sonnet-4-6")` via `@ai-sdk/anthropic`
  - `openai("gpt-4o")` via `@ai-sdk/openai`
  - `createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: GROQ_KEY })("llama-...")` for Groq
- **MCP**: if `chatMeta.agentConfig.mcpServer?.url` exists, call `experimental_createMCPClient` and merge tools
- **`onFinish`**: persist user + assistant messages, graphiti ingest, memory processing, title generation
- Return `result.toDataStreamResponse()`

### 2. `src/lib/tools.ts` — New file (replaces MEMORY_TOOLS + executeTool)
Convert all tools to Vercel AI SDK format with Zod schemas:
```typescript
import { tool } from "ai";
import { z } from "zod";

export const memoryTools = {
  query_memory: tool({
    description: "...",
    parameters: z.object({ question: z.string() }),
    execute: async ({ question }) => { ... }
  }),
  // ... all 8 existing tools
};
```

### 3. `src/components/chat/ChatView.tsx` — Replace SSE with `useChat`
```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: `/api/chats/${chatId}/messages`,
  initialMessages: loadedMessages,
  body: { model },
  onFinish: (msg) => { /* update title, scroll */ }
});
```
- Remove: `sendMessage()`, manual SSE reader, `streamingContent` state, `thinkingLabel` state
- Keep: model selector, chat metadata loading, file attachments

### 4. `src/components/chat/MessageBubble.tsx` — Add tool invocation rendering
```tsx
{message.toolInvocations?.map(inv => {
  if (inv.state !== "result") return <Spinner key={inv.toolCallId} />;
  if (inv.toolName.startsWith("vvd_")) {
    return <VVDChart key={inv.toolCallId} toolName={inv.toolName} result={inv.result} />;
  }
  return null;
})}
```

### 5. `src/components/charts/VVDChart.tsx` — New
Maps tool names to Recharts components:
- `vvd_actuals_summary` / `vvd_forecast_summary` → `<BarChart>` (by product category)
- `vvd_query_actuals` / `vvd_query_forecasts` → `<LineChart>` (over time)
- `vvd_compare_forecast_actuals` → `<ComposedChart>` (forecast vs actual)
- Other → formatted `<pre>` JSON fallback

### 6. `src/types/index.ts`
Add to `AgentConfig`:
```typescript
mcpServer?: {
  url: string;
  label?: string;
};
```

### 7. `src/components/chat/PromptModal.tsx`
Add MCP URL input field. On save, include `mcpServer: { url }` in PATCH body.

### 8. `src/app/api/chats/[chatId]/route.ts`
Handle `mcpServer` in PATCH handler alongside existing `systemPrompt` handling.

---

## Key decisions

- **No RSC/streamUI**: Use `useChat` + `toolInvocations`. Charts render client-side based on tool name. Simpler than React Server Components.
- **Model routing**: `useChat` body includes `{ model }` on every request.
- **MCP tool names**: Use VVD tool names as-is (`vvd_actuals_summary` etc.). No synthetic prefix needed.
- **Message persistence**: `onFinish` on server handles storage. `initialMessages` on `useChat` loads previous messages on mount.
- **Groq support**: `createOpenAI({ baseURL: "https://api.groq.com/openai/v1" })` via `@ai-sdk/openai`.
- **All existing integrations preserved**: Attio, Calendar, Graphiti tools port into new `tools.ts` with Zod schemas. Storage layer unchanged.

---

## Verification
1. Send a plain text message → streams correctly via `useChat`
2. Ask about memory → tool call fires, `toolInvocations` shows loading state
3. Configure MCP URL in PromptModal → saved to agentConfig
4. Ask a VVD question → MCP tool fires, chart renders inline in chat
5. Switch model to GPT/Groq → still works via `@ai-sdk/openai`
6. Refresh page → previous messages load via `initialMessages`
7. `npm run build` → no TypeScript errors
