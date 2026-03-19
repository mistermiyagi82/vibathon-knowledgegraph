"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function MessageInput({ onSend, disabled, autoFocus }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      {/* Pill container */}
      <div className="flex items-center gap-3 bg-black/[0.05] rounded-2xl px-5 py-4">
        {/* + file button */}
        <label className="cursor-pointer text-ink/40 hover:text-ink/70 transition-colors duration-150 text-lg leading-none select-none shrink-0 font-light">
          +
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.webp,.txt"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>

        {/* Text input */}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          placeholder="Ask anything..."
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-ink font-normal outline-none placeholder:text-ink/30 caret-ink disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={(!text.trim() && !file) || disabled}
          className="text-xs font-medium tracking-widest text-ink/40 hover:text-ink/80 transition-colors duration-150 disabled:opacity-30 select-none shrink-0 uppercase"
          aria-label="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
}
