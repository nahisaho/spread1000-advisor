import { describe, it, expect } from 'vitest';
import { exportProposalToMarkdown } from './MarkdownExporter';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';
import type { Proposal } from '@/domain/models/Proposal';

function makeProposal(): Proposal {
  return {
    projectId: 'proj-1',
    sections: [
      {
        id: 'research_purpose',
        title: '研究目的',
        content: 'AI研究の目的を述べる',
        charLimit: { min: 80, max: 400 },
      },
      {
        id: 'research_method',
        title: '研究方法',
        content: '手法の説明',
        charLimit: { min: 160, max: 800 },
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

describe('MarkdownExporter', () => {
  it('concatenates sections with markdown headers', () => {
    const result = exportProposalToMarkdown(makeProposal(), 'proj-1');
    const text = result.data.toString('utf-8');

    expect(text).toContain('# SPReAD-1000 研究計画調書');
    expect(text).toContain('## 研究目的');
    expect(text).toContain('AI研究の目的を述べる');
    expect(text).toContain('## 研究方法');
    expect(text).toContain('手法の説明');
  });

  it('appends disclaimer', () => {
    const result = exportProposalToMarkdown(makeProposal(), 'proj-1');
    const text = result.data.toString('utf-8');

    expect(text).toContain(DISCLAIMER_TEXT);
  });

  it('returns correct mime type and filename', () => {
    const result = exportProposalToMarkdown(makeProposal(), 'proj-1');

    expect(result.mimeType).toBe('text/markdown; charset=utf-8');
    expect(result.filename).toMatch(/^proj-1_様式1_研究計画調書_\d{8}\.md$/);
  });

  it('returns UTF-8 buffer', () => {
    const result = exportProposalToMarkdown(makeProposal(), 'proj-1');

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
