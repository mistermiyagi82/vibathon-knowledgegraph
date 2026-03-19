"use client";

import { useEffect, useState } from "react";
import type { MessageContext } from "@/types";

interface Props {
  context: MessageContext;
  onClose: () => void;
}

export default function ContextModal({ context, onClose }: Props) {
  const [show, setShow] = useState({ graph: true, history: true, files: true });

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
      <div className="fixed top-0 left-0 h-full w-full sm:w-80 z-50 bg-background shadow-xl animate-fade-in flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink/6">
          <p className="text-xs text-muted uppercase tracking-widest font-light">Sources</p>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors text-lg leading-none">×</button>
        </div>

        {/* Legend — clickable toggles */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink/6">
          {[
            { key: "graph" as const, label: "Graph", dot: "bg-violet-400" },
            { key: "history" as const, label: "History", dot: "bg-amber-400" },
            { key: "files" as const, label: "Files", dot: "bg-blue-400" },
          ].map(({ key, label, dot }) => (
            <button
              key={key}
              onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider transition-all duration-150 ${
                show[key]
                  ? "border-ink/15 bg-ink/5 text-ink/70 hover:bg-ink/10"
                  : "border-ink/8 bg-transparent text-muted/40 hover:bg-ink/5"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 transition-opacity ${dot} ${show[key] ? "opacity-100" : "opacity-30"}`} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {isEmpty && (
            <p className="text-[10px] text-muted">No memory sources for this response.</p>
          )}

          {show.graph && context.graph.map((f, i) => (
            <div key={i} className="pl-2 border-l-2 border-violet-400">
              <p className="text-[10px] text-ink/70 leading-snug">
                {f.subject} {f.relationship.toLowerCase().replace(/_/g, " ")} {f.object}
              </p>
            </div>
          ))}

          {show.history && context.history.map((h, i) => (
            <div key={i} className="pl-2 border-l-2 border-amber-400">
              <p className="text-[10px] text-ink/70 leading-snug">{h.excerpt}</p>
            </div>
          ))}

          {show.files && context.files.map((f, i) => (
            <div key={i} className="pl-2 border-l-2 border-blue-400">
              <a
                href={`/api/files/${f.chatId}/${f.filename}`}
                download
                className="text-[10px] text-ink/70 hover:text-ink transition-colors leading-snug block"
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
