"use client";

import { useEffect, useState } from "react";
import type { Template, AttioContact } from "@/types";

interface Props {
  contact: AttioContact;
  onSelect: (template: Template | null) => void;
  onBack: () => void;
  loading: boolean;
}

const PARTY_COLORS: Record<string, string> = {
  candidate: "bg-violet-100 text-violet-700",
  recruiter: "bg-blue-100 text-blue-700",
  client: "bg-amber-100 text-amber-700",
  general: "bg-ink/8 text-ink/60",
};

export default function TemplatePicker({ contact, onSelect, onBack, loading }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-ink/40 hover:text-ink transition-colors text-sm"
        >
          ← Back
        </button>
        <span className="text-sm text-ink/60">
          Choose agent type for{" "}
          <span className="text-ink font-medium">{contact.name}</span>
        </span>
      </div>

      {fetching ? (
        <p className="text-xs text-muted text-center py-4">Loading templates...</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              disabled={loading}
              className="w-full text-left px-4 py-3.5 rounded-xl border border-ink/8 hover:bg-ink/5 transition-colors disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{template.name}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${PARTY_COLORS[template.party] ?? PARTY_COLORS.general}`}>
                  {template.party}
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">{template.description}</p>
            </button>
          ))}

          <button
            onClick={() => onSelect(null)}
            disabled={loading}
            className="w-full text-left px-4 py-3.5 rounded-xl border border-ink/8 border-dashed hover:bg-ink/5 transition-colors disabled:opacity-40"
          >
            <div className="text-sm font-medium text-ink/60">Blank chat</div>
            <p className="text-xs text-muted mt-1">No template — start with the default agent</p>
          </button>
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted text-center py-2 animate-pulse">Creating chat...</p>
      )}
    </div>
  );
}
