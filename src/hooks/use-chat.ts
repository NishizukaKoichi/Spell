'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';

export interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface UseChatOptions {
  conversationId?: string | null;
  onSuccess?: (userMessage: Message, assistantMessage: Message) => void;
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, metadata?: Record<string, unknown>) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearMessages: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId, onSuccess, onError } = options;
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load message history on mount
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      const url = new URL('/api/chat/messages', window.location.origin);
      if (conversationId) {
        url.searchParams.set('conversationId', conversationId);
      }
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('Failed to load message history:', err);
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string, metadata?: Record<string, unknown>) => {
      if (!content.trim()) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            conversationId,
            metadata,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to send message');
        }

        const data = await response.json();
        const { userMessage, assistantMessage } = data;

        // Add both messages to the list
        setMessages((prev) => [...prev, userMessage, assistantMessage]);

        // Call success callback
        if (onSuccess) {
          onSuccess(userMessage, assistantMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });

        // Call error callback
        if (onError && err instanceof Error) {
          onError(err);
        }

        console.error('Failed to send message:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, onSuccess, onError, toast]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadHistory,
    clearMessages,
  };
}
