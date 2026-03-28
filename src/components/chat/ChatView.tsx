"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "ai/react";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import MessageInput from "./MessageInput";
import MemoryModal from "./MemoryModal";
import ContextModal from "./ContextModal";
import PromptModal from "./PromptModal";
import type { Message, MessageContext, MemoryOverview, ToolInvocation } from "@/types";

interface Props {
  chatId: string;
}

export default function ChatView({ chatId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stored messages from the server (have context, perf, usage metadata)
  const [storedMessages, setStoredMessages] = useState<Message[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [memoryUpdated, setMemoryUpdated] = useState(false);

  const [contextMessage, setContextMessage] = useState<MessageContext | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const MODELS = [
    { id: "claude-opus-4-6", label: "Opus 4.6" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
    { id: "claude-opus-4-5-20251101", label: "Opus 4.5" },
    { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    { id: "claude-opus-4-20250514", label: "Opus 4" },
    { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
    { id: "claude-3-haiku-20240307", label: "Haiku 3" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  ];

  const [model, setModel] = useState(
    () =>
      (typeof window !== "undefined" ? localStorage.getItem("selected-model") : null) ??
      "claude-sonnet-4-6"
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentFirstRef = useRef(false);
  const initialMsgIdsRef = useRef<Set<string> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // useChat manages streaming state — we use storedMessages for enriched metadata
  const { messages: chatMessages, setMessages: setChatMessages, isLoading, append } = useChat({
    api: `/api/chats/${chatId}/messages`,
    body: { model },
    onFinish: async () => {
      // Reload enriched messages from storage (picks up context, perf, usage)
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (res.ok) {
          const data = await res.json();
          const msgs: Message[] = data.messages || [];
          setStoredMessages(msgs);
          setChatMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              createdAt: new Date(m.timestamp),
            }))
          );
        }
      } catch { /* non-critical */ }
      scrollToBottom();
      loadRecentChats();
      loadMemoryOverview().then(() => {
        setMemoryUpdated(true);
        setTimeout(() => setMemoryUpdated(false), 2200);
      });
    },
    onError: () => { /* errors handled inline via isLoading */ },
  });

  // On chatId change: reset and load
  useEffect(() => {
    setInitialLoaded(false);
    setStoredMessages([]);
    setChatMessages([]);
    initialMsgIdsRef.current = null;
    sentFirstRef.current = false;
    loadMessages();
    loadMemoryOverview();
    loadRecentChats();
  }, [chatId]);

  // Send ?first= message after initial load
  useEffect(() => {
    if (!initialLoaded) return;
    const first = searchParams.get("first");
    if (first && !sentFirstRef.current) {
      sentFirstRef.current = true;
      router.replace(`/chat/${chatId}`);
      setTimeout(() => append({ role: "user", content: first }), 100);
    }
  }, [initialLoaded]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMemoryOpen(false);
        setContextMessage(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function loadMessages() {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.status === 404) { router.push("/"); return; }
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = data.messages || [];
      setStoredMessages(msgs);
      const chatMsgs = msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: new Date(m.timestamp),
      }));
      setChatMessages(chatMsgs);
      // Record initial IDs so we know which messages were there on load
      if (initialMsgIdsRef.current === null) {
        initialMsgIdsRef.current = new Set(chatMsgs.map((m) => m.id));
      }
      setInitialLoaded(true);
      setTimeout(scrollToBottom, 50);
    } catch {}
  }

  async function loadMemoryOverview() {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) setOverview(await res.json());
    } catch {}
  }

  async function loadRecentChats() {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) setRecentChats(await res.json());
    } catch {}
  }

  async function handleOpenContext(messageId: string) {
    try {
      setActiveMessageId(messageId);
      const res = await fetch(`/api/context/${messageId}`);
      if (res.ok) setContextMessage(await res.json());
      else setActiveMessageId(null);
    } catch { setActiveMessageId(null); }
  }

  async function sendMessage(text: string, file?: File) {
    if (!text.trim() && !file) return;
    if (file) {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/upload/${chatId}`, { method: "POST", body: form }).catch(() => {});
    }
    await append({ role: "user", content: text });
  }

  // Merge chatMessages (with toolInvocations from AI SDK) with storedMessages (with metadata)
  const displayMessages: Message[] = chatMessages.map((msg) => {
    const stored = storedMessages.find((s) => s.id === msg.id);
    return {
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      timestamp: stored?.timestamp ?? msg.createdAt?.toISOString() ?? new Date().toISOString(),
      context: stored?.context,
      perf: stored?.perf,
      model: stored?.model,
      usage: stored?.usage,
      attachments: stored?.attachments,
      toolInvocations: (msg as { toolInvocations?: ToolInvocation[] }).toolInvocations,
    };
  });

  // Build message list with date separators and animations
  const messageElements: React.ReactNode[] = [];
  let lastDate = "";
  const total = displayMessages.length;
  const maxStagger = 8;

  for (let i = 0; i < displayMessages.length; i++) {
    const msg = displayMessages[i];
    const isInitial = initialMsgIdsRef.current?.has(msg.id) ?? false;
    const isNew = initialMsgIdsRef.current !== null && !isInitial;
    const reverseIndex = total - 1 - i;
    const shouldStagger = isInitial && reverseIndex < maxStagger;
    const delay = shouldStagger ? 120 + reverseIndex * 40 : 0;

    const dateKey = msg.timestamp.slice(0, 10);
    if (dateKey && dateKey !== lastDate) {
      messageElements.push(<DateSeparator key={`sep-${dateKey}`} date={msg.timestamp} />);
      lastDate = dateKey;
    }

    const isStreamingMsg =
      isLoading && i === displayMessages.length - 1 && msg.role === "assistant";

    messageElements.push(
      <div
        key={msg.id}
        className={shouldStagger ? "animate-slide-up" : ""}
        style={
          shouldStagger
            ? { animationDelay: `${delay}ms`, opacity: 0, animationFillMode: "both" }
            : undefined
        }
      >
        <MessageBubble
          message={msg}
          streaming={isStreamingMsg}
          onOpenContext={msg.role === "assistant" ? handleOpenContext : undefined}
          isActive={msg.id === activeMessageId}
          isNew={isNew}
        />
      </div>
    );
  }

  // Thinking indicator — shown while loading before first assistant token appears
  const lastMsg = displayMessages[displayMessages.length - 1];
  const showThinking =
    isLoading &&
    (!lastMsg ||
      lastMsg.role === "user" ||
      (lastMsg.role === "assistant" &&
        !lastMsg.content &&
        !(lastMsg.toolInvocations?.length)));

  if (showThinking) {
    messageElements.push(
      <div key="thinking" className="mb-8 animate-fade-in">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="shrink-0 py-4 sm:py-5 animate-fade-in" style={{ animationDelay: "0ms", animationDuration: "200ms" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Menu button */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="menu-fade p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
                aria-label="Menu"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3.5" width="12" height="1.2" rx="0.6" fill="currentColor" />
                  <rect x="2" y="7.4" width="12" height="1.2" rx="0.6" fill="currentColor" />
                  <rect x="2" y="11.3" width="12" height="1.2" rx="0.6" fill="currentColor" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute top-full left-0 mt-2 z-50 bg-background border border-ink/8 rounded-xl shadow-sm py-2 w-52 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/"); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-ink/70 hover:text-ink hover:bg-ink/4 transition-colors"
                    >
                      ← Home
                    </button>
                    {recentChats.length > 0 && (
                      <div className="border-t border-ink/8 mt-1 pt-1">
                        {recentChats.slice(0, 8).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setMenuOpen(false); router.push(`/chat/${c.id}`); }}
                            className={`w-full text-left px-4 py-2 text-sm truncate transition-colors ${
                              c.id === chatId ? "text-ink" : "text-ink/60 hover:text-ink hover:bg-ink/4"
                            }`}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Back button */}
            <button
              onClick={() => router.push("/")}
              className="menu-fade p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
              aria-label="Back to home"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPromptOpen(true)}
              className="menu-fade p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
              aria-label="Edit system prompt"
              title="Edit system prompt"
            >
              ✏️
            </button>
            <button
              onClick={() => setMemoryOpen(true)}
              className="menu-fade p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
              aria-label="Memory"
              title="Memory"
            >
              🧠
            </button>
          </div>
        </div>
      </div>

      {/* Messages — scrollable, centered */}
      <div
        className="flex-1 min-h-0 relative animate-fade-in"
        style={{ animationDelay: "80ms", animationDuration: "300ms", opacity: 0, animationFillMode: "both" }}
      >
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
            {messageElements}
          </div>
        </div>
      </div>

      {/* Input */}
      <div
        className="shrink-0 pb-6 sm:pb-8 pt-2"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <MessageInput
            onSend={sendMessage}
            disabled={isLoading}
            autoFocus
            model={model}
            onModelChange={(id) => {
              setModel(id);
              localStorage.setItem("selected-model", id);
            }}
          />
        </div>
      </div>

      {memoryOpen && (
        <MemoryModal
          overview={overview}
          memoryUpdated={memoryUpdated}
          onClose={() => setMemoryOpen(false)}
          chatId={chatId}
        />
      )}

      {promptOpen && <PromptModal chatId={chatId} onClose={() => setPromptOpen(false)} />}

      {contextMessage && (
        <ContextModal
          context={contextMessage}
          onClose={() => { setContextMessage(null); setActiveMessageId(null); }}
        />
      )}
    </div>
  );
}
