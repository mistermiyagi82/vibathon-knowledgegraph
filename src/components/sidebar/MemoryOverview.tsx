import type { MemoryOverview } from "@/types";

export default function MemoryOverviewPanel({ overview }: { overview: MemoryOverview | null }) {
  if (!overview) return <div className="p-4 text-gray-400">Loading memory…</div>;

  return (
    <div className="p-4 space-y-6">
      <section>
        <h2 className="font-semibold mb-2">What I know about you</h2>
        <ul className="text-sm space-y-1">
          {overview.facts.map((f, i) => (
            <li key={i}>{f.subject} → {f.relationship} → {f.object}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Files uploaded</h2>
        <ul className="text-sm space-y-1">
          {overview.files.map((f, i) => (
            <li key={i}>
              <a href={f.path} download>{f.filename}</a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Session stats</h2>
        <p className="text-sm">Total chats: {overview.stats.totalChats}</p>
        <p className="text-sm">First session: {overview.stats.firstSession}</p>
        <p className="text-sm">Last session: {overview.stats.lastSession}</p>
      </section>
    </div>
  );
}
