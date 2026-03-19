"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Message, PerfEntry } from "@/types";

interface Props {
  message: Message;
  streaming?: boolean;
  onOpenContext?: (messageId: string) => void;
  isActive?: boolean;
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

export default function MessageBubble({ message, streaming, onOpenContext, isActive, isNew }: Props) {
  const [hovered, setHovered] = useState(false);
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    const clickable = !streaming && !!onOpenContext;
    return (
      <div
        className={[
          "mb-8",
          isNew ? "animate-fade-in" : "",
          clickable && !isActive ? "cursor-pointer -mx-3 px-3 py-2 rounded-lg transition-colors duration-150 hover:bg-ink/5" : "",
          clickable && isActive ? "cursor-pointer -mx-3 pl-2 pr-3 py-2 rounded-lg border-l-2 border-violet-400 bg-violet-50/60" : "",
        ].join(" ")}
        onClick={clickable ? () => onOpenContext!(message.id) : undefined}
      >
        <div className="text-sm leading-7 text-ink font-light prose-sm prose-neutral max-w-none [&_strong]:font-semibold [&_em]:italic [&_code]:bg-ink/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-ink/5 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
          <ReactMarkdown>{message.content}</ReactMarkdown>
          {streaming && <span className="blink-cursor" />}
        </div>

        {!streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-muted/60">{formatTimestamp(message.timestamp)}</span>
            {message.model && (
              <span className="text-[10px] font-mono text-muted/60">{message.model}</span>
            )}
            {message.perf?.map((p: PerfEntry, i: number) => (
              <span key={i} className="text-[10px] font-mono text-muted/60 flex items-center gap-x-3">
                <span className="text-muted/30 font-bold">→</span>{p.step}{p.ms >= 0 ? ` ${p.ms}ms` : ""}
              </span>
            ))}
            {message.perf && message.perf.filter(p => p.ms >= 0).length > 1 && (
              <span className="text-[10px] font-mono text-muted/60 flex items-center gap-x-3">
                <span className="text-muted/30 font-bold">→</span>total {message.perf.filter(p => p.ms >= 0).reduce((sum, p) => sum + p.ms, 0)}ms
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // User message — right-aligned white card
  return (
    <div className={`flex justify-end mb-8 ${isNew ? "animate-slide-up" : ""}`}>
      <div className="max-w-[85%] sm:max-w-[70%]">
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
