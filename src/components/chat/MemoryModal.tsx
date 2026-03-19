"use client";

import { useEffect } from "react";
import type { MemoryOverview } from "@/types";
import InfoTooltip from "./InfoTooltip";

interface Props {
  overview: MemoryOverview | null;
  memoryUpdated: boolean;
  onClose: () => void;
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MemoryModal({ overview, memoryUpdated, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>

      {/* Drawer from right */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-80 z-50 bg-background shadow-xl animate-fade-in flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink/6">
          <p className="text-xs text-muted uppercase tracking-widest font-light">Memory</p>
          <div className="flex items-center gap-2">
            <InfoTooltip text="This is everything the assistant remembers about you across all conversations — facts it has learned, files you've shared, and your session history." />
            <button
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {!overview || (overview.facts.length === 0 && overview.files.length === 0 && overview.stats.totalChats === 0) ? (
            <p className="text-xs text-muted">No memory yet.</p>
          ) : (
            <>
              {overview.facts.length > 0 && (
                <section>
                  <p className="text-xs text-muted uppercase tracking-widest mb-3">What I know</p>
                  <ul className="space-y-1.5">
                    {overview.facts.slice(0, 12).map((f, i) => (
                      <li key={i} className="text-xs text-ink/70">
                        {f.subject !== "user" && f.subject !== "User"
                          ? `${f.subject} `
                          : ""}
                        <span className="text-ink/40 text-xs">
                          {f.relationship.toLowerCase().replace(/_/g, " ")}
                        </span>{" "}
                        {f.object}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {overview.files.length > 0 && (
                <section>
                  <p className="text-xs text-muted uppercase tracking-widest mb-3">Files</p>
                  <ul className="space-y-2">
                    {overview.files.map((f, i) => (
                      <li key={i}>
                        <a
                          href={`/api/files/${f.chatId}/${f.filename}`}
                          download
                          className="text-xs text-ink/80 hover:text-ink transition-colors"
                        >
                          {f.filename}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {overview.stats.totalChats > 0 && (
                <section>
                  <p className="text-xs text-muted">
                    {overview.stats.totalChats} conversation{overview.stats.totalChats !== 1 ? "s" : ""}
                    {overview.stats.firstSession
                      ? ` · Since ${formatDate(overview.stats.firstSession)}`
                      : ""}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {memoryUpdated && (
          <div className="px-6 py-4 border-t border-ink/6">
            <p className="text-xs text-muted animate-memory-updated">Memory updated</p>
          </div>
        )}
      </div>
    </>
  );
}
