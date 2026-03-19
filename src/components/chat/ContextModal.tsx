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
    <>
      {/* Drawer from left */}
      <div className="fixed top-0 left-0 h-full w-full sm:w-80 z-50 bg-background shadow-xl animate-fade-in flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink/6">
          <p className="text-xs text-muted uppercase tracking-widest font-light">Sources</p>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isEmpty && (
            <p className="text-xs text-muted">No memory sources for this response.</p>
          )}

          {context.graph.map((f, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[0].color} py-0.5`}>
              <p className="text-[11px] text-ink/70 leading-relaxed">
                {f.subject} {f.relationship.toLowerCase().replace(/_/g, " ")} {f.object}
              </p>
            </div>
          ))}

          {context.history.map((h, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[1].color} py-0.5`}>
              <p className="text-[11px] text-ink/70 leading-relaxed">{h.excerpt}</p>
            </div>
          ))}

          {context.files.map((f, i) => (
            <div key={i} className={`pl-3 border-l-2 ${SOURCES[2].color} py-0.5`}>
              <a
                href={`/api/files/${f.chatId}/${f.filename}`}
                download
                className="text-[11px] text-ink/70 hover:text-ink transition-colors leading-relaxed block"
              >
                {f.filename} ↓
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
