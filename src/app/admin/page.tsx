"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
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
    setSaved(false);
    await fetch("/api/admin/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setOriginal(prompt);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setPrompt(original);
  }

  const isDirty = prompt !== original;

  return (
    <main className="min-h-screen bg-background px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-normal text-ink mb-1">Admin</h1>
      <p className="text-sm text-muted mb-10">Changes take effect on the next message sent.</p>

      <section>
        <label className="block text-sm font-medium text-ink mb-3">System Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={20}
          className="w-full bg-black/[0.04] rounded-xl px-4 py-3 text-sm text-ink font-mono outline-none resize-y placeholder:text-muted caret-ink border border-transparent focus:border-ink/10 transition-colors"
          spellCheck={false}
        />
      </section>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-sm transition-colors disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {isDirty && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm text-ink/60 hover:text-ink transition-colors"
          >
            Reset
          </button>
        )}
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </main>
  );
}
