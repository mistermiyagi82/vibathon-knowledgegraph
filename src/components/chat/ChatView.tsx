"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import MessageInput from "./MessageInput";
import MemoryModal from "./MemoryModal";
import ContextModal from "./ContextModal";
import type { Message, MessageContext, MemoryOverview } from "@/types";

interface Props {
  chatId: string;
}

export default function ChatView({ chatId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("");
  const [newMessageIds, setNewMessageIds] = useState<string[]>([]);

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
    { id: "claude-opus-4-1-20250805", label: "Opus 4.1" },
    { id: "claude-opus-4-20250514", label: "Opus 4" },
    { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
    { id: "claude-3-haiku-20240307", label: "Haiku 3" },
  ];
  const [model, setModel] = useState(() => localStorage.getItem("selected-model") ?? "claude-sonnet-4-6");


  const [menuOpen, setMenuOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentFirstRef = useRef(false);
  const isStreamingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadMemoryOverview();
    loadRecentChats();
  }, [chatId]);

  useEffect(() => {
    const first = searchParams.get("first");
    if (first && !sentFirstRef.current && messages.length === 0) {
      sentFirstRef.current = true;
      router.replace(`/chat/${chatId}`);
      setTimeout(() => sendMessage(first), 100);
    }
  }, [messages.length]);

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
      // Don't overwrite temp messages if a stream is already in flight
      if (!isStreamingRef.current) {
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 50);
      }
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

    const tempUserId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempUserId,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setNewMessageIds((prev) => [...prev, tempUserId]);
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamingContent("");
    setThinkingLabel("");
    setTimeout(scrollToBottom, 50);

    if (file) {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/upload/${chatId}`, { method: "POST", body: form }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));

            if (payload.thinking) {
              setThinkingLabel(payload.thinking);
            }

            if (payload.text) {
              setThinkingLabel("");
              accumulated += payload.text;
              setStreamingContent(accumulated);
              scrollToBottom();
            }

            if (payload.done) {
              const context = payload.context as MessageContext;
              const finalUserMsg: Message = {
                id: payload.userMessageId || tempUserId,
                role: "user",
                content: text,
                timestamp: new Date().toISOString(),
              };
              const finalAssistantMsg: Message = {
                id: payload.messageId,
                role: "assistant",
                content: accumulated,
                timestamp: new Date().toISOString(),
                context,
                perf: payload.perf,
                model: model,
              };

              setMessages((prev) => [
                ...prev.filter((m) => m.id !== tempUserId),
                finalUserMsg,
                finalAssistantMsg,
              ]);
              setNewMessageIds((prev) => [...prev, finalAssistantMsg.id]);
              setStreamingContent("");
              setThinkingLabel("");
              isStreamingRef.current = false;
              setIsStreaming(false);

              if (payload.title) loadRecentChats();

              loadMemoryOverview().then(() => {
                setMemoryUpdated(true);
                setTimeout(() => setMemoryUpdated(false), 2200);
              });

              scrollToBottom();
            }

            if (payload.error) {
              isStreamingRef.current = false;
              setIsStreaming(false);
              setStreamingContent("");
              setMessages((prev) => [
                ...prev,
                { id: `err-${Date.now()}`, role: "assistant" as const, content: `Error: ${payload.error}`, timestamp: new Date().toISOString() },
              ]);
            }
          } catch {}
        }
      }
    } catch {
      isStreamingRef.current = false;
      setIsStreaming(false);
      setStreamingContent("");
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserId),
        { id: tempUserId, role: "user" as const, content: text, timestamp: new Date().toISOString() },
        { id: `err-${Date.now()}`, role: "assistant" as const, content: "Something went wrong. Please try again.", timestamp: new Date().toISOString() },
      ]);
    }
  }

  // Build message list with date separators
  const messageElements: React.ReactNode[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const dateKey = msg.timestamp.slice(0, 10);
    if (dateKey && dateKey !== lastDate) {
      messageElements.push(<DateSeparator key={`sep-${dateKey}`} date={msg.timestamp} />);
      lastDate = dateKey;
    }
    messageElements.push(
      <MessageBubble
        key={msg.id}
        message={msg}
        onOpenContext={msg.role === "assistant" ? handleOpenContext : undefined}
        isActive={msg.id === activeMessageId}
        isNew={newMessageIds.includes(msg.id)}
      />
    );
  }

  if (isStreaming && !streamingContent) {
    messageElements.push(
      <div key="thinking" className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce [animation-delay:300ms]" />
          </div>
          {thinkingLabel && (
            <span className="text-xs text-ink/40 animate-fade-in">{thinkingLabel}</span>
          )}
        </div>
      </div>
    );
  }

  if (isStreaming && streamingContent) {
    messageElements.push(
      <MessageBubble
        key="streaming"
        message={{ id: "streaming", role: "assistant", content: streamingContent, timestamp: new Date().toISOString() }}
        streaming
      />
    );
  }


  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="shrink-0 py-4 sm:py-5">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Menu button */}
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

        {/* Memory button — gear icon */}
        <button
          onClick={() => setMemoryOpen(true)}
          className="menu-fade p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
          aria-label="Memory"
          title="Memory"
        >
          ⚙️
        </button>
      </div>
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-14 left-8 bg-background border border-ink/8 rounded-xl shadow-sm py-2 w-max max-w-xs"
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
        </div>
      )}

      {/* Messages — scrollable, centered */}
      <div className="flex-1 min-h-0 relative">
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
            {messageElements}
          </div>
        </div>
      </div>

      {/* Input — centered */}
      <div className="shrink-0 pb-6 sm:pb-8 pt-2" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <MessageInput
            onSend={sendMessage}
            disabled={isStreaming}
            autoFocus
            model={model}
            onModelChange={(id) => { setModel(id); localStorage.setItem("selected-model", id); }}
          />
        </div>
      </div>

      {/* Memory drawer modal */}
      {memoryOpen && (
        <MemoryModal
          overview={overview}
          memoryUpdated={memoryUpdated}
          onClose={() => setMemoryOpen(false)}
          chatId={chatId}
        />
      )}

      {/* Context modal */}
      {contextMessage && (
        <ContextModal
          context={contextMessage}
          onClose={() => { setContextMessage(null); setActiveMessageId(null); }}
        />
      )}
    </div>
  );
}
