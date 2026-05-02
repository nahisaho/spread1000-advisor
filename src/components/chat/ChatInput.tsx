'use client';

import { useCallback, useRef, useState } from 'react';
import type { ActionButton } from '@/domain/models/ChatMessage';

interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  actionButtons?: readonly ActionButton[];
  onAction?: (action: string) => void;
}

export function ChatInput({ onSend, placeholder, disabled, actionButtons, onAction }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3" data-testid="chat-input">
      {actionButtons && actionButtons.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {actionButtons.map((btn) => (
            <button
              key={btn.action}
              type="button"
              onClick={() => onAction?.(btn.action)}
              disabled={btn.disabled || disabled}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                btn.variant === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : btn.variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'メッセージを入力...'}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed max-h-[150px]"
          data-testid="chat-textarea"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="chat-send"
          aria-label="送信"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
