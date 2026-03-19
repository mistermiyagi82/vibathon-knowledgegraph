export default function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400">{date}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
