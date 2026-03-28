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
  cachedContact?: AttioContact;
}

export interface PerfEntry {
  step: string;
  ms: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  costEur: number;
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
  usage?: TokenUsage;
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

export interface AttioVacancy {
  id: string;
  title?: string;
  description?: string;
  requirements?: string;
  status?: string;            // open / closed / on-hold etc.
  company?: string;           // Resolved company name
  companyId?: string;         // Raw company record ID
  companyDescription?: string;
  companyWebsite?: string;
}

export interface AttioRecruitingEntry {
  stage?: string;
  applyingFor?: string;       // Role title (select)
  role?: string;              // Free-text role description
  roleLevel?: string;
  team?: string;
  manager?: string;
  employmentStatus?: string;
  potentialStartDate?: string;
  sourceType?: string;
  source?: string;
  hiringCompany?: string;     // company_name field (legacy text field)
  interviewDate?: string;
  vacancyId?: string;         // Linked vacancy record ID
  vacancy?: AttioVacancy;     // Fully resolved vacancy + company
  entryId?: string;           // Recruiting list entry ID (needed for stage updates)
}

export interface AttioContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;           // Current employer (linked company record)
  companyId?: string;         // Raw company record ID for further lookups
  jobTitle?: string;
  notes?: string;
  recruiting?: AttioRecruitingEntry;
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
