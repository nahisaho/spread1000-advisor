"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  const [displayedLength, setDisplayedLength] = useState(
    isStreaming ? 0 : text.length,
  );
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(text.length);
      return;
    }

    if (displayedLength >= text.length) return;

    const timer = setTimeout(() => {
      setDisplayedLength((prev) => Math.min(prev + 1, text.length));
    }, 20);

    return () => clearTimeout(timer);
  }, [isStreaming, displayedLength, text.length]);

  useEffect(() => {
    // Only reset when a new stream starts (text shrinks or changes entirely)
    if (isStreaming && text.length < prevTextRef.current.length) {
      setDisplayedLength(0);
    }
    prevTextRef.current = text;
  }, [text, isStreaming]);

  const displayedText = text.slice(0, displayedLength);

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {displayedText}
      </ReactMarkdown>
      {isStreaming && displayedLength < text.length && (
        <span
          className="inline-block h-4 w-0.5 animate-pulse bg-current align-text-bottom"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
