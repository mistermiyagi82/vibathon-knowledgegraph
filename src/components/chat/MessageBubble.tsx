"use client";
import type { Message } from "@/types";

interface Props {
  message: Message;
  onSelect?: (messageId: string) => void;
}

// TODO: implement full bubble UI per design
export default function MessageBubble({ message, onSelect }: Props) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`flex ${isAssistant ? "justify-start" : "justify-end"} mb-2`}
      onClick={() => isAssistant && onSelect?.(message.id)}
    >
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100">
        <p>{message.content}</p>
        <span className="text-xs text-gray-400 mt-1 block">{message.timestamp}</span>
      </div>
    </div>
  );
}
