"use client";

import { useState } from "react";
import type { Message } from "@/types";

interface Props {
  message: Message;
  streaming?: boolean;
  onSelect?: (messageId: string) => void;
  isSelected?: boolean;
  isNew?: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({ message, streaming, onSelect, isSelected, isNew }: Props) {
  const [hovered, setHovered] = useState(false);
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div
        className={`flex justify-start mb-6 cursor-pointer group ${isNew ? "animate-fade-in" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect?.(message.id)}
      >
        <div className={`pl-4 max-w-[72%] relative transition-opacity duration-150 ${isSelected ? "opacity-70" : ""}`}>
          <p className="text-sm leading-7 text-ink font-light whitespace-pre-wrap">
            {message.content}
            {streaming && <span className="blink-cursor" />}
          </p>
          {hovered && !streaming && (
            <span className="text-xs text-muted mt-1 block animate-fade-in">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // User message — right-aligned white card
  return (
    <div
      className={`flex justify-end mb-6 ${isNew ? "animate-slide-up" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="max-w-[60%]">
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
        {hovered && (
          <div className="flex justify-end mt-1 animate-fade-in">
            <span className="text-xs text-muted">{formatTime(message.timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
