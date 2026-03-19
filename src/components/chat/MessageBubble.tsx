"use client";

import { useState } from "react";
import type { Message } from "@/types";

interface Props {
  message: Message;
  streaming?: boolean;
  onOpenContext?: (messageId: string) => void;
  isNew?: boolean;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${time} · ${date}`;
}

function formatTimeHover(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({ message, streaming, onOpenContext, isNew }: Props) {
  const [hovered, setHovered] = useState(false);
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className={`mb-8 ${isNew ? "animate-fade-in" : ""}`}>
        <p className="text-sm leading-7 text-ink font-light whitespace-pre-wrap">
          {message.content}
          {streaming && <span className="blink-cursor" />}
        </p>

        {/* Timestamp + source button — always visible, hidden while streaming */}
        {!streaming && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted/60">
              {formatTimestamp(message.timestamp)}
            </span>
            {onOpenContext && (
              <button
                onClick={() => onOpenContext(message.id)}
                className="text-xs text-muted/50 hover:text-muted transition-colors"
                title="View sources"
              >
                Sources
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // User message — right-aligned white card
  return (
    <div className={`flex justify-end mb-8 ${isNew ? "animate-slide-up" : ""}`}>
      <div className="max-w-[70%]">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-sm leading-6 text-ink whitespace-pre-wrap">{message.content}</p>
          {message.attachments?.map((att) => (
            <a
              key={att.filename}
              href={`/api/files/${att.chatId}/${att.filename}`}
              download
              className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-black/5 text-xs text-ink hover:bg-black/10 transition-colors"
            >
              <span>{att.filename}</span>
              <span>↓</span>
            </a>
          ))}
        </div>
        <div className="flex justify-end mt-2">
          <span className="text-xs text-muted/60">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
