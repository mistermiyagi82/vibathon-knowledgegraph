"use client";

import { useState, useEffect } from "react";

interface Props {
  chatId: string;
  onClose: () => void;
}

export default function PromptModal({ chatId, onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [originalMcpUrl, setOriginalMcpUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/chats/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        const perChat = d?.meta?.agentConfig?.systemPrompt;
        const mcp = d?.meta?.agentConfig?.mcpServer?.url ?? "";
        setMcpUrl(mcp);
        setOriginalMcpUrl(mcp);
        if (perChat?.trim()) {
          setPrompt(perChat.trim());
          setOriginal(perChat.trim());
        } else {
          fetch("/api/admin/prompt")
            .then((r) => r.json())
            .then((g) => {
              setPrompt(g.prompt);
              setOriginal(g.prompt);
            });
        }
      });
  }, [chatId]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: prompt,
        mcpServer: mcpUrl.trim() ? { url: mcpUrl.trim() } : null,
      }),
    });
    setOriginal(prompt);
    setOriginalMcpUrl(mcpUrl);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDirty = prompt !== original || mcpUrl !== originalMcpUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-lg w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink/8">
          <span className="text-sm font-medium text-ink flex items-center gap-1.5">✏️ Agent Settings</span>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors text-lg leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* System prompt */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-ink/50 uppercase tracking-wide">System Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[260px] bg-transparent text-sm text-ink font-mono outline-none resize-none placeholder:text-muted caret-ink"
              spellCheck={false}
            />
          </div>

          {/* MCP server URL */}
          <div className="flex flex-col gap-2 border-t border-ink/8 pt-5">
            <label className="text-xs font-medium text-ink/50 uppercase tracking-wide">MCP Server URL</label>
            <p className="text-xs text-ink/40">
              Connect an MCP server to give this agent additional tools (e.g. VVD data).
            </p>
            <input
              type="url"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="https://your-mcp-server.com/sse"
              className="w-full bg-ink/4 rounded-lg px-3 py-2 text-sm text-ink font-mono outline-none placeholder:text-muted/50 focus:bg-ink/6 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-ink/8">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-sm transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {isDirty && (
            <button
              onClick={() => { setPrompt(original); setMcpUrl(originalMcpUrl); }}
              className="px-4 py-1.5 rounded-lg text-sm text-ink/50 hover:text-ink transition-colors"
            >
              Reset
            </button>
          )}
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </div>
    </div>
  );
}
