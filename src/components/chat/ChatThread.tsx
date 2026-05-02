'use client';

import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage } from '@/domain/models/ChatMessage';

interface ChatThreadProps {
  messages: readonly ChatMessage[];
  onAction?: (action: string, payload?: unknown) => void;
}

export function ChatThread({ messages, onAction }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessageContent = messages.length > 0 ? messages[messages.length - 1].content : '';

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, lastMessageContent]);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      data-testid="chat-thread"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
          <span className="text-4xl">💬</span>
          <p className="text-sm">チャットを開始してください</p>
        </div>
      )}

      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} onAction={onAction} />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
