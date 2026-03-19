"use client";
import { useState } from "react";

interface Props {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
}

// TODO: implement full input UI per design
export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | undefined>();

  function handleSubmit() {
    if (!text.trim() && !file) return;
    onSend(text, file);
    setText("");
    setFile(undefined);
  }

  return (
    <div className="flex items-center gap-2 p-4 border-t">
      <label className="cursor-pointer">
        📎
        <input
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.webp,.txt"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <input
        className="flex-1 border rounded px-3 py-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
        placeholder="Type a message…"
        disabled={disabled}
      />
      <button onClick={handleSubmit} disabled={disabled}>Send</button>
    </div>
  );
}
