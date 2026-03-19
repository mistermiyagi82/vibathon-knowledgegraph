import type { MessageContext } from "@/types";

interface Props {
  context: MessageContext;
  onDismiss: () => void;
}

export default function ContextView({ context, onDismiss }: Props) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">This response was based on</h2>
        <button onClick={onDismiss} className="text-gray-400 text-sm">✕</button>
      </div>

      <section>
        <h3 className="text-sm font-medium mb-1">From graph</h3>
        <ul className="text-xs space-y-1">
          {context.graph.map((f, i) => (
            <li key={i}>{f.subject} → {f.relationship} → {f.object}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-1">From history</h3>
        <ul className="text-xs space-y-1">
          {context.history.map((h, i) => (
            <li key={i}>
              <span className="text-gray-400">{h.chatTitle} · {h.timestamp}</span>
              <p>{h.excerpt}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-1">From files</h3>
        <ul className="text-xs space-y-1">
          {context.files.map((f, i) => (
            <li key={i}><a href={f.path} download>{f.filename}</a></li>
          ))}
        </ul>
      </section>

      {context.recent && (
        <p className="text-xs text-gray-400">Recent window included.</p>
      )}
    </div>
  );
}
