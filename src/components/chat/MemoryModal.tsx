"use client";

import { useEffect, useState } from "react";
import type { MemoryOverview } from "@/types";
import InfoTooltip from "./InfoTooltip";

interface Props {
  overview: MemoryOverview | null;
  memoryUpdated: boolean;
  onClose: () => void;
  chatId: string;
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MemoryModal({ overview, memoryUpdated, onClose, chatId }: Props) {
  const [tab, setTab] = useState<"memory" | "file">("memory");
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadRaw() {
    if (rawContent !== null) return;
    setLoadingRaw(true);
    try {
      const res = await fetch(`/api/chats/${chatId}/raw`);
      setRawContent(res.ok ? await res.text() : "(empty)");
    } catch {
      setRawContent("(failed to load)");
    } finally {
      setLoadingRaw(false);
    }
  }

  function handleTab(t: "memory" | "file") {
    setTab(t);
    if (t === "file") loadRaw();
  }

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

        {/* Pills row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink/6">
          {[
            { key: "memory" as const, label: "Memory", dot: "bg-violet-400" },
            { key: "file" as const, label: "MD File", dot: "bg-amber-400" },
          ].map(({ key, label, dot }) => (
            <button
              key={key}
              onClick={() => handleTab(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider transition-all duration-150 ${
                tab === key
                  ? "border-ink/15 bg-ink/5 text-ink/70 hover:bg-ink/10"
                  : "border-ink/8 bg-transparent text-muted/40 hover:bg-ink/5"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 transition-opacity ${dot} ${tab === key ? "opacity-100" : "opacity-30"}`} />
              {label}
            </button>
          ))}
        </div>

        {tab === "memory" && (
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
        )}

        {tab === "file" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loadingRaw ? (
              <p className="text-xs text-muted">Loading...</p>
            ) : (
              <pre className="text-xs text-ink/60 whitespace-pre-wrap break-words font-mono leading-relaxed">
                {rawContent || "(empty)"}
              </pre>
            )}
          </div>
        )}

        {memoryUpdated && (
          <div className="px-6 py-4 border-t border-ink/6">
            <p className="text-xs text-muted animate-memory-updated">Memory updated</p>
          </div>
        )}
      </div>
    </>
  );
}
