'use client';

/**
 * Simple Chat Example
 *
 * This is a simplified version of the chat interface that demonstrates
 * the backend integration. You can use this as a reference to update
 * the main chat interface.
 */

import { useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { ChatMessageList } from '@/components/chat-message-list';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

export function SimpleChatExample() {
  const [input, setInput] = useState('');
  const { messages, isLoading, error, sendMessage } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b border-border/50 bg-background px-4 py-3">
        <h1 className="text-xl font-semibold">Chat</h1>
      </header>

      <ChatMessageList messages={messages} isLoading={isLoading} error={error} />

      <div className="border-t border-border/50 bg-background p-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[52px] max-h-[200px] resize-none"
              rows={1}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 shrink-0"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
