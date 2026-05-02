import type { Proposal } from '@/domain/models/Proposal';
import type { ExportResult } from '@/domain/interfaces/IExportService';
import { appendDisclaimer } from '@/lib/disclaimer';

export function exportProposalToMarkdown(
  proposal: Proposal,
  projectId: string,
): ExportResult {
  const lines: string[] = [`# SPReAD-1000 研究計画調書`, ''];

  for (const section of proposal.sections) {
    lines.push(`## ${section.title}`, '', section.content, '');
  }

  const content = appendDisclaimer(lines.join('\n'));
  const data = Buffer.from(content, 'utf-8');

  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  return {
    filename: `${projectId}_様式1_研究計画調書_${date}.md`,
    mimeType: 'text/markdown; charset=utf-8',
    data,
  };
}
