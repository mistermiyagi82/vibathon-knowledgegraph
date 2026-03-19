"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Chat } from "@/types";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LandingPage() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchChats();
  }, []);

  async function fetchChats() {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) setChats(await res.json());
    } catch {}
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);

    try {
      // Create new chat
      const res = await fetch("/api/chats", { method: "POST" });
      const chat: Chat = await res.json();

      // Navigate to the chat, passing the initial message via query
      router.push(`/chat/${chat.id}?first=${encodeURIComponent(input.trim())}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center" style={{ minWidth: 1280 }}>
      {/* Wordmark */}
      <div className="w-full max-w-2xl px-8 pt-12 pb-0">
        <span className="text-xs font-light tracking-widest text-muted uppercase select-none">
          mem
        </span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-8 -mt-16">
        <h1 className="text-3xl font-normal text-ink mb-10 text-center leading-snug">
          Hey, what do you want to chat about today?
        </h1>

        {/* Input */}
        <form onSubmit={handleSubmit} className="w-full flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
            placeholder=""
            disabled={loading}
            className="flex-1 bg-transparent text-ink text-base font-light outline-none placeholder:text-muted caret-ink"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="text-muted hover:text-ink transition-colors duration-150 disabled:opacity-0 text-lg select-none"
            aria-label="Send"
          >
            →
          </button>
        </form>

        {/* Divider */}
        <div className="w-full h-px bg-ink/10 mt-4 mb-8" />

        {/* Recent chats */}
        {chats.length > 0 && (
          <div className="w-full space-y-0">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="w-full flex items-baseline justify-between py-3 group text-left hover:opacity-60 transition-opacity duration-150"
              >
                <div className="flex-1 min-w-0 pr-6">
                  <span className="text-sm text-ink font-normal block truncate">
                    {chat.title}
                  </span>
                  {chat.lastMessagePreview && (
                    <span className="text-xs text-muted block truncate mt-0.5">
                      {chat.lastMessagePreview}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted shrink-0 tabular-nums">
                  {formatRelativeTime(chat.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
