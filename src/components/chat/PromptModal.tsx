"use client";

import { useState, useEffect } from "react";

interface Props {
  onClose: () => void;
}

export default function PromptModal({ onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/prompt")
      .then((r) => r.json())
      .then((d) => { setPrompt(d.prompt); setOriginal(d.prompt); });
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setOriginal(prompt);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDirty = prompt !== original;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-lg w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink/8">
          <span className="text-sm font-medium text-ink">System Prompt</span>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors text-lg leading-none">×</button>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-full min-h-[320px] bg-transparent text-sm text-ink font-mono outline-none resize-none placeholder:text-muted caret-ink"
            spellCheck={false}
          />
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
              onClick={() => setPrompt(original)}
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
