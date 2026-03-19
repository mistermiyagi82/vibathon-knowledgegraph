"use client";

import { useState, useRef, useEffect } from "react";

interface ModelOption {
  id: string;
  label: string;
}

const PROVIDERS = [
  {
    name: "Claude",
    models: [
      { id: "claude-opus-4-6", label: "Opus 4.6" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-opus-4-5-20251101", label: "Opus 4.5" },
      { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    ],
  },
  {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "o3", label: "o3" },
      { id: "o4-mini", label: "o4 mini" },
      { id: "o1", label: "o1" },
    ],
  },
  {
    name: "Groq",
    models: [
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    ],
  },
  {
    name: "Kimi",
    models: [
      { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2" },
    ],
  },
  {
    name: "Qwen",
    models: [
      { id: "qwen/qwen3-32b", label: "Qwen 3 32B" },
    ],
  },
  { name: "Grok", models: [] },
];

interface Props {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  model?: string;
  models?: ModelOption[];
  onModelChange?: (modelId: string) => void;
}

export default function MessageInput({ onSend, disabled, autoFocus, model, onModelChange }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  const allModels = PROVIDERS.flatMap(p => p.models);
  const currentModelLabel = allModels.find(m => m.id === model)?.label ?? model;

  // Focus on mount
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Refocus after send completes (disabled flips false)
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function handleSubmit() {
    if ((!text.trim() && !file) || disabled) return;
    onSend(text, file);
    setText("");
    setFile(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    inputRef.current?.focus();
  }

  return (
    <div className="w-full">
      {/* File pill preview */}
      {file && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 text-xs text-ink">
            {file.name}
            <button
              onClick={() => {
                setFile(undefined);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted hover:text-ink ml-1 leading-none"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Container */}
      <div className="bg-black/[0.05] rounded-2xl px-4 pt-3 pb-3">
        {/* Text input row */}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          placeholder="Say something..."
          className={`w-full bg-transparent text-sm text-ink font-normal outline-none placeholder:text-ink/30 caret-ink transition-opacity mb-3 ${disabled ? "opacity-50" : ""}`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          {/* + file button */}
          <label className="cursor-pointer text-ink/40 hover:text-ink/70 transition-colors duration-150 text-lg leading-none select-none font-light">
            +
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.webp,.txt"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>

          <div className="flex items-center gap-3">
            {/* Model picker */}
            {onModelChange && (
              <div className="relative">
                <button
                  ref={modelBtnRef}
                  onClick={() => { setModelPickerOpen((o) => !o); setHoveredProvider("Claude"); }}
                  className="flex items-center gap-1 text-xs text-ink/40 hover:text-ink/70 transition-colors select-none"
                >
                  {currentModelLabel}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
                {modelPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setModelPickerOpen(false); setHoveredProvider(null); }} />
                    {/* Provider list */}
                    <div
                      className="absolute bottom-full mb-2 right-0 z-50 bg-background border border-ink/8 rounded-xl shadow-md py-1 min-w-[130px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {PROVIDERS.map((p) => (
                        <div
                          key={p.name}
                          className="relative px-1.5"
                          onMouseEnter={() => setHoveredProvider(p.name)}
                        >
                          <div className={`flex items-center justify-between px-3 py-1 text-xs cursor-default transition-colors rounded-lg ${p.models.length === 0 ? "text-ink/25" : hoveredProvider === p.name ? "bg-violet-100 text-violet-900" : "text-ink/60"}`}>
                            {p.name}
                            {p.models.length > 0 && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4L2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
                          </div>
                          {/* Models submenu */}
                          {hoveredProvider === p.name && p.models.length > 0 && (
                            <div className="absolute bottom-0 right-full mr-1 z-50 bg-background border border-ink/8 rounded-xl shadow-md py-1 min-w-[160px]">
                              {p.models.map((m) => (
                                <div key={m.id} className="px-1.5">
                                  <button
                                    onClick={() => { onModelChange(m.id); setModelPickerOpen(false); setHoveredProvider(null); }}
                                    className={`w-full text-left px-3 py-1 text-xs transition-colors hover:bg-violet-100 hover:text-violet-900 rounded-lg flex items-center justify-between ${model === m.id ? "text-ink font-medium" : "text-ink/60"}`}
                                  >
                                    {m.label}
                                    {model === m.id && <span className="text-violet-500 text-xs">✓</span>}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={(!text.trim() && !file) || disabled}
              className={`w-8 h-8 rounded-lg transition-all duration-300 flex items-center justify-center shrink-0 disabled:opacity-30 ${(text.trim() || file) ? "bg-violet-700 hover:bg-violet-800 scale-105" : "bg-violet-400 hover:bg-violet-500"}`}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
