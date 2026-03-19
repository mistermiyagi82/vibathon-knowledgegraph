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
  const [newMessageIds, setNewMessageIds] = useState<string[]>([]);

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [memoryUpdated, setMemoryUpdated] = useState(false);

  const [contextMessage, setContextMessage] = useState<MessageContext | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentFirstRef = useRef(false);

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
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
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
      const res = await fetch(`/api/context/${messageId}`);
      if (res.ok) setContextMessage(await res.json());
    } catch {}
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
    setIsStreaming(true);
    setStreamingContent("");
    scrollToBottom();

    if (file) {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/upload/${chatId}`, { method: "POST", body: form }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
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

            if (payload.text) {
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
              };

              setMessages((prev) => [
                ...prev.filter((m) => m.id !== tempUserId),
                finalUserMsg,
                finalAssistantMsg,
              ]);
              setNewMessageIds((prev) => [...prev, finalAssistantMsg.id]);
              setStreamingContent("");
              setIsStreaming(false);

              if (payload.title) loadRecentChats();

              loadMemoryOverview().then(() => {
                setMemoryUpdated(true);
                setTimeout(() => setMemoryUpdated(false), 2200);
              });

              scrollToBottom();
            }

            if (payload.error) {
              setIsStreaming(false);
              setStreamingContent("");
            }
          } catch {}
        }
      }
    } catch {
      setIsStreaming(false);
      setStreamingContent("");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
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
        isNew={newMessageIds.includes(msg.id)}
      />
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
      <div className="shrink-0 flex items-center justify-between px-8 py-5">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 5a3 3 0 1 0 0 6A3 3 0 0 0 8 5zm0 1.2a1.8 1.8 0 1 1 0 3.6A1.8 1.8 0 0 1 8 6.2z"
              fill="currentColor"
            />
            <path
              d="M6.6 1.4l-.4 1.1a5 5 0 0 0-.9.5l-1.1-.3-1.4 2.4.8.8a5 5 0 0 0 0 1l-.8.8 1.4 2.4 1.1-.3c.3.2.6.4.9.5l.4 1.1h2.8l.4-1.1c.3-.1.6-.3.9-.5l1.1.3 1.4-2.4-.8-.8a5 5 0 0 0 0-1l.8-.8-1.4-2.4-1.1.3a5 5 0 0 0-.9-.5L9.4 1.4H6.6zm.6 1.2h1.6l.3.9.5.3c.2.1.5.3.7.4l.5.2.9-.2.8 1.4-.7.7.1.5c0 .2.1.4.1.6s0 .4-.1.6l-.1.5.7.7-.8 1.4-.9-.2-.5.2c-.2.1-.5.3-.7.4l-.5.3-.3.9H7.2l-.3-.9-.5-.3a4 4 0 0 1-.7-.4l-.5-.2-.9.2-.8-1.4.7-.7-.1-.5A3.5 3.5 0 0 1 4 8c0-.2 0-.4.1-.6l.1-.5-.7-.7.8-1.4.9.2.5-.2c.2-.1.5-.3.7-.4l.5-.3.3-.9z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-14 left-8 bg-background border border-ink/8 rounded-xl shadow-sm py-2 min-w-48"
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-6 pt-4 pb-6">
          {messageElements}
        </div>
      </div>

      {/* Input — centered */}
      <div className="shrink-0 pb-8 pt-2">
        <div className="max-w-2xl mx-auto px-6">
          <MessageInput onSend={sendMessage} disabled={isStreaming} autoFocus />
        </div>
      </div>

      {/* Memory drawer modal */}
      {memoryOpen && (
        <MemoryModal
          overview={overview}
          memoryUpdated={memoryUpdated}
          onClose={() => setMemoryOpen(false)}
        />
      )}

      {/* Context modal */}
      {contextMessage && (
        <ContextModal
          context={contextMessage}
          onClose={() => setContextMessage(null)}
        />
      )}
    </div>
  );
}
