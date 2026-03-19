import type { MemoryOverview } from "@/types";

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MemoryOverviewPanel({ overview, memoryUpdated }: { overview: MemoryOverview | null; memoryUpdated?: boolean }) {
  if (!overview) return null;

  const hasContent =
    overview.facts.length > 0 ||
    overview.files.length > 0 ||
    overview.stats.totalChats > 0;

  if (!hasContent) return null;

  return (
    <div className="px-6 py-8 space-y-8 animate-fade-in">
      {/* Entity pills */}
      {overview.facts.length > 0 && (
        <section>
          <p className="text-xs text-muted mb-3 uppercase tracking-widest font-light">What I know</p>
          <div className="flex flex-wrap gap-2">
            {overview.facts.slice(0, 5).map((f, i) => (
              <span
                key={i}
                className="text-xs text-ink/70 px-2.5 py-1 rounded-full border border-ink/10 font-light"
              >
                {f.object || f.subject}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Files */}
      {overview.files.length > 0 && (
        <section>
          <p className="text-xs text-muted mb-3 uppercase tracking-widest font-light">Files</p>
          <ul className="space-y-2">
            {overview.files.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <a
                  href={`/api/files/${f.chatId}/${f.filename}`}
                  download
                  className="text-xs text-ink/80 hover:text-ink truncate transition-colors"
                >
                  {f.filename}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sessions */}
      {overview.stats.totalChats > 0 && (
        <section>
          <p className="text-xs text-muted font-light">
            {overview.stats.totalChats} conversation{overview.stats.totalChats !== 1 ? "s" : ""}
            {overview.stats.firstSession ? ` · Since ${formatDate(overview.stats.firstSession)}` : ""}
          </p>
        </section>
      )}

      {/* Memory updated flash */}
      {memoryUpdated && (
        <p className="text-xs text-muted animate-memory-updated">
          Memory updated
        </p>
      )}
    </div>
  );
}
