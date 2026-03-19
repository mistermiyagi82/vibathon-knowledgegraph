// Chat view — swap this component once your design is ready
import ChatView from "@/components/chat/ChatView";

export default function ChatPage({ params }: { params: { chatId: string } }) {
  return <ChatView chatId={params.chatId} />;
}
