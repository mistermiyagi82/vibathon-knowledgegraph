"use client";

import { useEffect } from "react";
import type { MessageContext } from "@/types";

interface Props {
  context: MessageContext;
  onClose: () => void;
}

const SOURCES = [
  { key: "graph", label: "From memory graph", color: "border-violet-400" },
  { key: "history", label: "From past conversations", color: "border-amber-400" },
  { key: "files", label: "From files", color: "border-blue-400" },
] as const;

export default function ContextModal({ context, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isEmpty =
    context.graph.length === 0 &&
    context.history.length === 0 &&
    context.files.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/10 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl shadow-lg w-full max-w-md mx-6 p-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-muted uppercase tracking-widest font-light">Based on</p>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {isEmpty && (
          <p className="text-sm text-muted">No memory sources for this response.</p>
        )}

        <div className="space-y-5">
          {context.graph.map((f, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[0].color}`}>
              <p className="text-xs text-muted mb-0.5">{SOURCES[0].label}</p>
              <p className="text-sm text-ink font-light leading-relaxed">
                {f.subject} {f.relationship.toLowerCase().replace(/_/g, " ")} {f.object}
              </p>
            </div>
          ))}

          {context.history.map((h, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[1].color}`}>
              <p className="text-xs text-muted mb-0.5">
                {SOURCES[1].label} · {h.chatTitle} ·{" "}
                {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <p className="text-sm text-ink font-light leading-relaxed line-clamp-4">{h.excerpt}</p>
            </div>
          ))}

          {context.files.map((f, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[2].color}`}>
              <p className="text-xs text-muted mb-0.5">{SOURCES[2].label}</p>
              <a
                href={`/api/files/${f.chatId}/${f.filename}`}
                download
                className="text-sm text-ink hover:underline"
              >
                {f.filename} ↓
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
