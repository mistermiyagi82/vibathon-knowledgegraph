export default function DateSeparator({ date }: { date: string }) {
  const label = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex justify-center my-6">
      <span className="text-xs text-muted select-none">{label}</span>
    </div>
  );
}
