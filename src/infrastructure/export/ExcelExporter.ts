import ExcelJS from 'exceljs';
import type { Proposal } from '@/domain/models/Proposal';
import type { ExportResult } from '@/domain/interfaces/IExportService';
import { sanitizeExcelCell } from '@/lib/sanitize';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';

function formatDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export async function exportProposalToExcel(
  proposal: Proposal,
  projectId: string,
): Promise<ExportResult> {
  const workbook = new ExcelJS.Workbook();

  // Main sheet
  const sheet = workbook.addWorksheet('様式1_研究計画調書');

  sheet.columns = [
    { header: '項目', key: 'label', width: 30 },
    { header: '内容', key: 'content', width: 80 },
  ];

  sheet.addRow({
    label: sanitizeExcelCell('SPReAD-1000 研究計画調書'),
    content: '',
  });

  for (const section of proposal.sections) {
    sheet.addRow({
      label: sanitizeExcelCell(section.title),
      content: sanitizeExcelCell(section.content),
    });
  }

  // Disclaimer sheet
  const disclaimerSheet = workbook.addWorksheet('免責事項');
  disclaimerSheet.columns = [{ header: '免責事項', key: 'text', width: 100 }];
  disclaimerSheet.addRow({ text: sanitizeExcelCell(DISCLAIMER_TEXT) });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    filename: `${projectId}_様式1_研究計画調書_${formatDate()}.xlsx`,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    data: buffer,
  };
}
