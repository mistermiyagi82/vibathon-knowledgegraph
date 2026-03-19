"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import MessageInput from "./MessageInput";
import Sidebar from "@/components/sidebar/Sidebar";
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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<MessageContext | null>(null);
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [memoryUpdated, setMemoryUpdated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string }>>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const sentFirstRef = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load initial messages
  useEffect(() => {
    loadMessages();
    loadMemoryOverview();
    loadRecentChats();
  }, [chatId]);

  // Handle first message from landing page
  useEffect(() => {
    const first = searchParams.get("first");
    if (first && !sentFirstRef.current && messages.length === 0) {
      sentFirstRef.current = true;
      // Small delay so the view mounts first
      setTimeout(() => sendMessage(first), 100);
    }
  }, [messages.length]);

  // Keyboard: Escape dismisses context
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else if (selectedMessageId) dismissContext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, selectedMessageId]);

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

  async function handleSelectMessage(messageId: string) {
    if (selectedMessageId === messageId) {
      dismissContext();
      return;
    }
    setSelectedMessageId(messageId);
    try {
      const res = await fetch(`/api/context/${messageId}`);
      if (res.ok) setSelectedContext(await res.json());
    } catch {}
  }

  function dismissContext() {
    setSelectedMessageId(null);
    setSelectedContext(null);
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

    // File upload if present
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
      let assistantMessageId = "";
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
              assistantMessageId = payload.messageId;
              const userMessageId = payload.userMessageId;
              const context = payload.context as MessageContext;

              // Replace temp user message with real one
              const finalUserMsg: Message = {
                id: userMessageId || tempUserId,
                role: "user",
                content: text,
                timestamp: new Date().toISOString(),
              };

              const finalAssistantMsg: Message = {
                id: assistantMessageId,
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

              // Title update
              if (payload.title) {
                // The title was generated; reload chats list
                loadRecentChats();
              }

              // Refresh memory overview and show "Memory updated" flash
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

  // Group messages with date separators
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
        onSelect={msg.role === "assistant" ? handleSelectMessage : undefined}
        isSelected={msg.id === selectedMessageId}
        isNew={newMessageIds.includes(msg.id)}
      />
    );
  }

  // Streaming placeholder
  if (isStreaming && streamingContent) {
    const streamMsg: Message = {
      id: "streaming",
      role: "assistant",
      content: streamingContent,
      timestamp: new Date().toISOString(),
    };
    messageElements.push(
      <MessageBubble key="streaming" message={streamMsg} streaming />
    );
  }

  return (
    <div className="flex h-screen bg-background" style={{ minWidth: 1280 }}>
      {/* Menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-14 left-6 bg-background border border-ink/8 rounded-xl shadow-sm py-2 min-w-48"
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
                      c.id === chatId
                        ? "text-ink font-normal"
                        : "text-ink/60 hover:text-ink hover:bg-ink/4"
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

      {/* Chat column */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Menu button */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="menu-fade absolute top-5 left-5 z-30 p-1.5 rounded-lg hover:bg-ink/5 transition-colors"
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3.5" width="12" height="1.2" rx="0.6" fill="currentColor" />
            <rect x="2" y="7.4" width="12" height="1.2" rx="0.6" fill="currentColor" />
            <rect x="2" y="11.3" width="12" height="1.2" rx="0.6" fill="currentColor" />
          </svg>
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-16 pt-16 pb-6">
          {messageElements}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-16 py-6 border-t border-ink/6">
          <MessageInput
            onSend={sendMessage}
            disabled={isStreaming}
            autoFocus
          />
        </div>
      </main>

      {/* Sidebar */}
      <Sidebar
        overview={overview}
        selectedContext={selectedContext}
        onDismiss={dismissContext}
        memoryUpdated={memoryUpdated}
      />
    </div>
  );
}
