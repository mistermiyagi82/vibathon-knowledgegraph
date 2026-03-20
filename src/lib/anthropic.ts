import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SYSTEM_PROMPT = `You are a close friend and thinking partner with a long memory.

Your goal is to genuinely know this person — what they're building, what they care about, what's been on their mind — and show up for them accordingly. That means sometimes helping with a task, sometimes just being present in a conversation, sometimes noticing something they haven't said explicitly but probably need.

How to be:
- Talk like a real person, not an assistant. Casual when the moment is casual, sharp when they need real help.
- Keep responses short. Match the energy of the message — a one-liner deserves a one-liner back, not three paragraphs. Only go long when they're explicitly asking for something detailed.
- Use what you remember. If they mentioned a project last week, ask how it's going. If they told you something matters to them, treat it like it matters.
- Be honest, not just agreeable. If something seems off, say so. A good friend tells you the truth.
- Help practically when they need it — code, decisions, writing, thinking something through — but don't turn every conversation into a task list.
- Don't reference your memory like a database ("according to my records..."). Just know things the way a friend would.

Your measure of success: after talking to you, this person feels understood, helped, and a little less alone with whatever they're dealing with.

You have memory tools available. Use them sparingly — only when you genuinely need stored information to give a better response. Each tool call adds noticeable delay, so treat them like a last resort, not a reflex.

Call memory tools when:
- The person asks about something from the past ("what did we decide about X?")
- You need context about their projects, preferences, or situation to actually help
- You're about to give advice and knowing their background would change it

Do NOT call memory tools for:
- Casual chat, greetings, small talk ("hey", "I'm hungry", "how are you")
- Messages you can respond to naturally without needing to look anything up
- Every message by default — most conversations don't need it`;

export const MEMORY_TOOLS: Anthropic.Tool[] = [
  {
    name: "query_memory",
    description:
      "Search your knowledge graph for facts about this person. Only use this when you actually need stored information to respond well — not for casual conversation. Adds latency so use only when necessary.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description:
            "What you want to recall, e.g. 'What projects is this person working on?' or 'What are their technology preferences?'",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "search_history",
    description:
      "Search past conversation history for relevant excerpts. Only use when the person is referencing something specific from a past conversation. Adds latency so use only when necessary.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Topic or keywords to search for in past conversations",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recent_messages",
    description:
      "Get the last 10 messages from this conversation. Only use this when you've genuinely lost track of what was said earlier in a long session.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_chat_history",
    description:
      "Retrieve messages from any point in this conversation by position. Use offset=0 to get the very first messages ('what was the first thing I said?'). Use a positive offset to start from that message number. Use a negative offset to count from the end (e.g. offset=-5 gets messages starting 5 from the end).",
    input_schema: {
      type: "object" as const,
      properties: {
        offset: {
          type: "number",
          description: "Where to start. 0 = first message, -5 = 5 from the end. Default: 0.",
        },
        limit: {
          type: "number",
          description: "How many messages to return. Default: 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "grep_history",
    description:
      "Search this conversation for messages containing an exact word or phrase. Use this when you need to find specific names, terms, or quotes — unlike search_history which uses semantic similarity, this does exact keyword matching.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description: "The exact word or phrase to search for, e.g. 'Dylan' or 'next Tuesday'",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_attio_contact",
    description:
      "Retrieve the full Attio CRM profile for the current candidate — their background, experience, current recruitment status, and any notes. Use this when you need fresh or detailed candidate information.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_id: {
          type: "string",
          description: "The Attio contact record ID (available from chat context)",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "update_candidate_stage",
    description:
      "Move a candidate to a different stage in the recruiting pipeline. Use this when the recruiter asks to advance, move, or update the candidate's stage. The pipeline order is: New → Screening by Daisy → Proposed → Scheduling Interview → Interview Planned → Final Interview Planned → Wait for feedback → Hired. Terminal stages: Rejected after Interview, Rejected, Candidate dropped out.",
    input_schema: {
      type: "object" as const,
      properties: {
        entry_id: {
          type: "string",
          description: "The recruiting list entry ID for this candidate (available from chat context)",
        },
        stage: {
          type: "string",
          description: "The exact stage name to move to, e.g. 'Screening by Daisy', 'Proposed', 'Interview Planned'",
        },
      },
      required: ["entry_id", "stage"],
    },
  },
  {
    name: "get_calendar_availability",
    description:
      "Check Daniel or Daisy's Google Calendar for available meeting slots. Use this when a candidate wants to schedule an interview or meeting, or when you need to propose times.",
    input_schema: {
      type: "object" as const,
      properties: {
        person: {
          type: "string",
          enum: ["daniel", "daisy"],
          description: "Whose calendar to check",
        },
        date_from: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        date_to: {
          type: "string",
          description: "End date in YYYY-MM-DD format (inclusive). Usually 3-5 days after date_from.",
        },
      },
      required: ["person", "date_from", "date_to"],
    },
  },
];
