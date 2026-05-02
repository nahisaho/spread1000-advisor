'use client';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  return (
    <textarea
      className="w-full min-h-[200px] rounded-md border border-gray-300 bg-white p-3 font-mono text-sm leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid="markdown-editor"
    />
  );
}
