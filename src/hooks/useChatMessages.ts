'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, RichContent } from '@/domain/models/ChatMessage';
import { createMessage, createStepDivider } from '@/domain/models/ChatMessage';
import type { StepId } from '@/domain/models/WizardStep';

export interface UseChatMessagesReturn {
  messages: readonly ChatMessage[];
  addUserMessage: (content: string, stepId?: StepId) => ChatMessage;
  addAssistantMessage: (content: string, options?: { richContent?: RichContent; stepId?: StepId }) => ChatMessage;
  addSystemMessage: (content: string, stepId?: StepId) => ChatMessage;
  addStepDivider: (stepId: StepId, label: string) => ChatMessage;
  updateMessage: (id: string, updates: Partial<Pick<ChatMessage, 'content' | 'richContent' | 'isStreaming'>>) => void;
  startStreaming: (stepId?: StepId) => string;
  appendToStreaming: (id: string, chunk: string) => void;
  finishStreaming: (id: string, richContent?: RichContent) => void;
}

export function useChatMessages(): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const streamingIdRef = useRef<string | null>(null);

  const addMessage = useCallback((msg: ChatMessage): ChatMessage => {
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const addUserMessage = useCallback((content: string, stepId?: StepId) => {
    return addMessage(createMessage('user', content, { stepId }));
  }, [addMessage]);

  const addAssistantMessage = useCallback(
    (content: string, options?: { richContent?: RichContent; stepId?: StepId }) => {
      return addMessage(createMessage('assistant', content, options));
    },
    [addMessage],
  );

  const addSystemMessage = useCallback((content: string, stepId?: StepId) => {
    return addMessage(createMessage('system', content, { stepId }));
  }, [addMessage]);

  const addStepDivider = useCallback((stepId: StepId, label: string) => {
    return addMessage(createStepDivider(stepId, label));
  }, [addMessage]);

  const updateMessage = useCallback(
    (id: string, updates: Partial<Pick<ChatMessage, 'content' | 'richContent' | 'isStreaming'>>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
      );
    },
    [],
  );

  const startStreaming = useCallback((stepId?: StepId): string => {
    const msg = createMessage('assistant', '', { stepId, isStreaming: true });
    streamingIdRef.current = msg.id;
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }, []);

  const appendToStreaming = useCallback((id: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content: msg.content + chunk } : msg)),
    );
  }, []);

  const finishStreaming = useCallback((id: string, richContent?: RichContent) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, isStreaming: false, richContent: richContent ?? msg.richContent } : msg,
      ),
    );
    streamingIdRef.current = null;
  }, []);

  return {
    messages,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    addStepDivider,
    updateMessage,
    startStreaming,
    appendToStreaming,
    finishStreaming,
  };
}
