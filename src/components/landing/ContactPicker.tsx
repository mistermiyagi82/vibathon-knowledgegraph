"use client";

import { useState, useEffect, useRef } from "react";
import type { AttioContact } from "@/types";

interface Props {
  onSelect: (contact: AttioContact) => void;
  onBack: () => void;
}

export default function ContactPicker({ onSelect, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttioContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/attio/contacts?search=${encodeURIComponent(query)}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Search failed");
          setResults([]);
        } else {
          setResults(await res.json());
        }
      } catch {
        setError("Could not reach Attio");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-ink/40 hover:text-ink transition-colors text-sm"
        >
          ← Back
        </button>
        <span className="text-sm text-ink/60">Search for a candidate in Attio</span>
      </div>

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name or email..."
        className="w-full bg-ink/5 rounded-xl px-4 py-3 text-sm text-ink outline-none placeholder:text-muted caret-ink"
        autoComplete="off"
        spellCheck={false}
      />

      {loading && (
        <p className="text-xs text-muted text-center py-2">Searching...</p>
      )}

      {error && (
        <p className="text-xs text-red-500 text-center py-2">{error}</p>
      )}

      {!loading && results.length === 0 && query.trim() && !error && (
        <p className="text-xs text-muted text-center py-2">No contacts found</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {results.map((contact) => (
            <li key={contact.id}>
              <button
                onClick={() => onSelect(contact)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-ink/5 transition-colors"
              >
                <div className="text-sm font-medium text-ink">{contact.name}</div>
                {(contact.jobTitle || contact.company) && (
                  <div className="text-xs text-muted mt-0.5">
                    {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
                  </div>
                )}
                {contact.email && (
                  <div className="text-xs text-muted/60 mt-0.5">{contact.email}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
