import { tool } from "ai";
import { z } from "zod";
import { queryGraphMemory } from "@/lib/memory/graph";
import { semanticSearch } from "@/lib/memory/semantic";
import { getRecentMessages, getMessages, formatRecentMessages, grepHistory } from "@/lib/memory/recent";
import { getAttioContact, formatContactContext, updateCandidateStage } from "@/lib/attio";
import { graphitiSearch } from "@/lib/graphiti";
import { getCalendarAvailability, formatAvailability } from "@/lib/calendar";
import { updateChatMeta } from "@/lib/storage/chats";
import type { MessageContext } from "@/types";

export function buildMemoryTools(chatId: string, context: MessageContext) {
  return {
    query_memory: tool({
      description:
        "Search your knowledge graph for facts about this person. Only use this when you actually need stored information to respond well — not for casual conversation. Adds latency so use only when necessary.",
      parameters: z.object({
        question: z.string().describe(
          "What you want to recall, e.g. 'What projects is this person working on?' or 'What are their technology preferences?'"
        ),
      }),
      execute: async ({ question }) => {
        const facts = await queryGraphMemory(question, chatId);
        if (facts.length > 0) context.graph.push(...facts);
        return (
          facts.map((f) => `${f.subject} -[${f.relationship}]-> ${f.object}`).join("\n") ||
          "No relevant facts found."
        );
      },
    }),

    search_history: tool({
      description:
        "Search past conversation history for relevant excerpts. Only use when the person is referencing something specific from a past conversation. Adds latency so use only when necessary.",
      parameters: z.object({
        query: z.string().describe("Topic or keywords to search for in past conversations"),
      }),
      execute: async ({ query }) => {
        const excerpts = await semanticSearch(query);
        if (excerpts.length > 0) context.history.push(...excerpts);
        return (
          excerpts.map((e) => `[${e.chatTitle}] ${e.excerpt}`).join("\n\n") ||
          "No relevant history found."
        );
      },
    }),

    get_recent_messages: tool({
      description:
        "Get the last 10 messages from this conversation. Only use this when you've genuinely lost track of what was said earlier in a long session.",
      parameters: z.object({}),
      execute: async () => {
        const recent = getRecentMessages(chatId, 10);
        if (recent.length > 0) context.recent = true;
        return formatRecentMessages(recent) || "No recent messages.";
      },
    }),

    get_chat_history: tool({
      description:
        "Retrieve messages from any point in this conversation by position. Use offset=0 to get the very first messages. Use a negative offset to count from the end (e.g. offset=-5 gets messages starting 5 from the end).",
      parameters: z.object({
        offset: z
          .number()
          .optional()
          .describe("Where to start. 0 = first message, -5 = 5 from the end. Default: 0."),
        limit: z.number().optional().describe("How many messages to return. Default: 10."),
      }),
      execute: async ({ offset = 0, limit = 10 }) => {
        const msgs = getMessages(chatId, offset, limit);
        return formatRecentMessages(msgs) || "No messages found at that position.";
      },
    }),

    grep_history: tool({
      description:
        "Search this conversation for messages containing an exact word or phrase. Unlike search_history which uses semantic similarity, this does exact keyword matching.",
      parameters: z.object({
        keyword: z
          .string()
          .describe("The exact word or phrase to search for, e.g. 'Dylan' or 'next Tuesday'"),
      }),
      execute: async ({ keyword }) => {
        if (!keyword) return "No keyword provided.";
        const matches = grepHistory(chatId, keyword, 20);
        if (matches.length === 0) return `No messages found containing "${keyword}".`;
        return matches
          .map((m) => `${m.role === "user" ? "User" : "Claude"}: ${m.content}`)
          .join("\n\n");
      },
    }),

    get_attio_contact: tool({
      description:
        "Retrieve the full Attio CRM profile for the current candidate — their background, experience, current recruitment status, and any notes.",
      parameters: z.object({
        contact_id: z
          .string()
          .describe("The Attio contact record ID (available from chat context)"),
      }),
      execute: async ({ contact_id }) => {
        const contact = await getAttioContact(contact_id);
        if (!contact) return "Contact not found in Attio.";
        updateChatMeta(chatId, { cachedContact: contact });
        return formatContactContext(contact);
      },
    }),

    update_candidate_stage: tool({
      description:
        "Move a candidate to a different stage in the recruiting pipeline. Pipeline order: New → Screening by Daisy → Proposed → Scheduling Interview → Interview Planned → Final Interview Planned → Wait for feedback → Hired.",
      parameters: z.object({
        entry_id: z
          .string()
          .describe("The recruiting list entry ID for this candidate (available from chat context)"),
        stage: z
          .string()
          .describe(
            "The exact stage name to move to, e.g. 'Screening by Daisy', 'Proposed', 'Interview Planned'"
          ),
      }),
      execute: async ({ entry_id, stage }) => {
        return await updateCandidateStage(entry_id, stage);
      },
    }),

    query_graph: tool({
      description:
        "Search the knowledge graph for rich relational facts — relationships between entities, temporal facts, connections between people/companies/skills. More powerful than query_memory for relational questions.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "What relationship or fact to look for, e.g. 'Eelke Blonk salary expectations' or 'candidates with React skills'"
          ),
      }),
      execute: async ({ query }) => {
        try {
          const result = await graphitiSearch(query, [chatId]);
          return result || "No relevant graph facts found.";
        } catch {
          return "Knowledge graph unavailable — is the graphiti service running?";
        }
      },
    }),

    get_calendar_availability: tool({
      description:
        "Check Daniel or Daisy's Google Calendar for available meeting slots. Use this when a candidate wants to schedule an interview or meeting.",
      parameters: z.object({
        person: z.enum(["daniel", "daisy"]).describe("Whose calendar to check"),
        date_from: z.string().describe("Start date in YYYY-MM-DD format"),
        date_to: z
          .string()
          .describe("End date in YYYY-MM-DD format (inclusive). Usually 3-5 days after date_from."),
      }),
      execute: async ({ person, date_from, date_to }) => {
        const result = await getCalendarAvailability(person, date_from, date_to);
        return formatAvailability(person, result);
      },
    }),
  };
}
