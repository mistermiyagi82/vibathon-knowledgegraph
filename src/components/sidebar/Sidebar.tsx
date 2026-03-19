"use client";
import type { MessageContext, MemoryOverview } from "@/types";
import MemoryOverviewPanel from "./MemoryOverview";
import ContextView from "./ContextView";

interface Props {
  overview: MemoryOverview | null;
  selectedContext: MessageContext | null;
  onDismiss: () => void;
}

export default function Sidebar({ overview, selectedContext, onDismiss }: Props) {
  return (
    <aside className="w-80 border-l flex flex-col overflow-y-auto">
      {selectedContext ? (
        <ContextView context={selectedContext} onDismiss={onDismiss} />
      ) : (
        <MemoryOverviewPanel overview={overview} />
      )}
    </aside>
  );
}
