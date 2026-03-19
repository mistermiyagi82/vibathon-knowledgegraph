export interface AgentConfig {
  systemPrompt?: string; // Overrides global prompt for this chat
  model?: string;        // Model override
  tools?: string[];      // Which tools are enabled
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview?: string;
  // Recruiter agent fields
  contactId?: string;
  contactName?: string;
  templateId?: string;
  agentConfig?: AgentConfig;
}

export interface PerfEntry {
  step: string;
  ms: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  context?: MessageContext;
  perf?: PerfEntry[];
  model?: string;
}

export interface FileAttachment {
  filename: string;
  type: string;
  path: string;
  chatId: string;
}

export interface MessageContext {
  graph: GraphFact[];
  history: HistoryExcerpt[];
  files: FileAttachment[];
  recent: boolean;
}

export interface GraphFact {
  subject: string;
  relationship: string;
  object: string;
}

export interface HistoryExcerpt {
  chatId: string;
  chatTitle: string;
  timestamp: string;
  excerpt: string;
}

export interface MemoryOverview {
  facts: GraphFact[];
  files: FileAttachment[];
  stats: {
    totalChats: number;
    firstSession: string;
    lastSession: string;
  };
}

export interface AttioContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  status?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  party: "candidate" | "recruiter" | "client" | "general";
  systemPrompt: string;
  model?: string;
  tools?: string[];
}
