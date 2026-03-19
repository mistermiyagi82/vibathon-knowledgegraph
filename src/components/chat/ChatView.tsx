"use client";
// TODO: replace with your design
export default function ChatView({ chatId }: { chatId: string }) {
  return (
    <div className="flex h-screen">
      <main className="flex-1 flex flex-col">
        <p className="p-4 text-gray-500">Chat view for {chatId} — design coming soon.</p>
      </main>
      {/* Sidebar */}
      <aside className="w-80 border-l" />
    </div>
  );
}
