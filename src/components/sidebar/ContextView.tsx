"use client";

import type { MessageContext } from "@/types";

interface Props {
  context: MessageContext;
  onDismiss: () => void;
}

const ACCENT_COLORS = [
  "border-accent-violet",
  "border-accent-amber",
  "border-accent-blue",
];

export default function ContextView({ context, onDismiss }: Props) {
  const isEmpty =
    context.graph.length === 0 &&
    context.history.length === 0 &&
    context.files.length === 0;

  return (
    <div className="px-6 py-8 space-y-6 animate-fade-in">
      <p className="text-xs text-muted uppercase tracking-widest font-light">Based on</p>

      {isEmpty && (
        <p className="text-xs text-muted">No memory sources for this response.</p>
      )}

      {/* Graph facts */}
      {context.graph.map((f, i) => (
        <div
          key={i}
          className={`pl-3 border-l-2 ${ACCENT_COLORS[0]}`}
        >
          <p className="text-xs text-ink/80 font-light leading-relaxed">
            {f.subject} {f.relationship.toLowerCase().replace(/_/g, " ")} {f.object}
          </p>
        </div>
      ))}

      {/* Past conversations */}
      {context.history.map((h, i) => (
        <div
          key={i}
          className={`pl-3 border-l-2 ${ACCENT_COLORS[1]}`}
        >
          <p className="text-xs text-muted mb-0.5">
            {h.chatTitle} · {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <p className="text-xs text-ink/80 font-light leading-relaxed line-clamp-3">
            {h.excerpt}
          </p>
        </div>
      ))}

      {/* Files */}
      {context.files.map((f, i) => (
        <div
          key={i}
          className={`pl-3 border-l-2 ${ACCENT_COLORS[2]}`}
        >
          <a
            href={`/api/files/${f.chatId}/${f.filename}`}
            download
            className="text-xs text-ink/80 hover:text-ink transition-colors"
          >
            {f.filename} ↓
          </a>
        </div>
      ))}

      <button
        onClick={onDismiss}
        className="text-xs text-muted hover:text-ink transition-colors duration-150 pt-2"
      >
        esc to close
      </button>
    </div>
  );
}
