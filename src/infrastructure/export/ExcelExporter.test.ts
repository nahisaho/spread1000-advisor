import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { exportProposalToExcel } from './ExcelExporter';
import type { Proposal } from '@/domain/models/Proposal';

function makeProposal(overrides?: Partial<Proposal>): Proposal {
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
    ...overrides,
  };
}

describe('ExcelExporter', () => {
  it('creates a valid xlsx buffer', async () => {
    const result = await exportProposalToExcel(makeProposal(), 'proj-1');

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('filename matches expected pattern', async () => {
    const result = await exportProposalToExcel(makeProposal(), 'proj-1');

    expect(result.filename).toMatch(
      /^proj-1_様式1_研究計画調書_\d{8}\.xlsx$/,
    );
  });

  it('contains proposal sections in main sheet', async () => {
    const result = await exportProposalToExcel(makeProposal(), 'proj-1');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.data);

    const sheet = workbook.getWorksheet('様式1_研究計画調書');
    expect(sheet).toBeDefined();

    const values: string[] = [];
    sheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') values.push(cell.value);
      });
    });

    expect(values.some((v) => v.includes('研究目的'))).toBe(true);
    expect(values.some((v) => v.includes('研究方法'))).toBe(true);
    expect(values.some((v) => v.includes('AI研究の目的を述べる'))).toBe(true);
  });

  it('sanitizes formula injection in cell content', async () => {
    const proposal = makeProposal({
      sections: [
        {
          id: 'research_purpose',
          title: '研究目的',
          content: '=CMD("malicious")',
          charLimit: { min: 0, max: 400 },
        },
      ],
    });

    const result = await exportProposalToExcel(proposal, 'proj-1');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.data);

    const sheet = workbook.getWorksheet('様式1_研究計画調書');
    const values: string[] = [];
    sheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') values.push(cell.value);
      });
    });

    // Sanitized: should have leading quote
    const malicious = values.find((v) => v.includes('CMD'));
    expect(malicious).toBeDefined();
    expect(malicious!.startsWith("'=")).toBe(true);
  });

  it('includes disclaimer sheet', async () => {
    const result = await exportProposalToExcel(makeProposal(), 'proj-1');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.data);

    const disclaimerSheet = workbook.getWorksheet('免責事項');
    expect(disclaimerSheet).toBeDefined();

    const values: string[] = [];
    disclaimerSheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') values.push(cell.value);
      });
    });
    expect(values.some((v) => v.includes('免責事項'))).toBe(true);
  });
});
