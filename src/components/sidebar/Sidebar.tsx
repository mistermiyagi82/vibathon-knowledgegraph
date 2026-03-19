"use client";

import type { MessageContext, MemoryOverview } from "@/types";
import MemoryOverviewPanel from "./MemoryOverview";
import ContextView from "./ContextView";

interface Props {
  overview: MemoryOverview | null;
  selectedContext: MessageContext | null;
  onDismiss: () => void;
  memoryUpdated?: boolean;
}

export default function Sidebar({ overview, selectedContext, onDismiss, memoryUpdated }: Props) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto">
      <div className="relative">
        {selectedContext ? (
          <ContextView context={selectedContext} onDismiss={onDismiss} />
        ) : (
          <MemoryOverviewPanel overview={overview} memoryUpdated={memoryUpdated} />
        )}
      </div>
    </aside>
  );
}
