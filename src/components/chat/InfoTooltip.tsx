"use client";

interface Props {
  text: string;
}

export default function InfoTooltip({ text }: Props) {
  return (
    <div className="relative group">
      <button
        type="button"
        className="w-4 h-4 rounded-full border border-ink/20 text-muted hover:text-ink hover:border-ink/40 transition-colors text-[10px] leading-none flex items-center justify-center"
        tabIndex={-1}
      >
        ?
      </button>
      <div className="pointer-events-none absolute top-full right-0 mt-2 w-56 rounded-lg bg-ink text-background text-xs leading-relaxed px-3 py-2.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[60]">
        <div className="absolute bottom-full right-3 border-4 border-transparent border-b-ink" />
        {text}
      </div>
    </div>
  );
}
