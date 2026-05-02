import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportDeliverableUseCase } from './ExportDeliverableUseCase';
import type { IProjectRepository, DeliverableName } from '@/domain/interfaces/IProjectRepository';
import type { ExportResult } from '@/domain/interfaces/IExportService';
import { DISCLAIMER_TEXT } from '@/lib/disclaimer';

function createMockRepo(overrides: Partial<IProjectRepository> = {}): IProjectRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateWizardState: vi.fn(),
    saveDeliverable: vi.fn(),
    loadDeliverable: vi.fn().mockResolvedValue(null),
    listDeliverables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const excelResult: ExportResult = {
  filename: 'test.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  data: Buffer.from('excel-data'),
};

const zipResult: ExportResult = {
  filename: 'test.zip',
  mimeType: 'application/zip',
  data: Buffer.from('zip-data'),
};

describe('ExportDeliverableUseCase', () => {
  const mockExcelExporter = vi.fn().mockResolvedValue(excelResult);
  const mockMarkdownExporter = vi.fn().mockReturnValue({
    filename: 'test.md',
    mimeType: 'text/markdown; charset=utf-8',
    data: Buffer.from('md-data'),
  });
  const mockZipExporter = vi.fn().mockResolvedValue(zipResult);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportSingle', () => {
    it('exports markdown format with disclaimer', async () => {
      const repo = createMockRepo({
        loadDeliverable: vi.fn().mockResolvedValue('# Test Content'),
      });
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      const result = await useCase.exportSingle('proj-1', 'meta-prompt.md', 'markdown');

      expect(result.mimeType).toBe('text/markdown; charset=utf-8');
      expect(result.filename).toBe('proj-1_meta-prompt.md');
      const text = result.data.toString('utf-8');
      expect(text).toContain('# Test Content');
      expect(text).toContain(DISCLAIMER_TEXT);
    });

    it('exports xlsx format via excelExporter', async () => {
      const repo = createMockRepo({
        loadDeliverable: vi.fn().mockResolvedValue('# Excel Content'),
      });
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      const result = await useCase.exportSingle('proj-1', 'phase3-proposal.md', 'xlsx');

      expect(mockExcelExporter).toHaveBeenCalledOnce();
      expect(result).toBe(excelResult);
    });

    it('throws when deliverable not found', async () => {
      const repo = createMockRepo();
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      await expect(
        useCase.exportSingle('proj-1', 'meta-prompt.md', 'markdown'),
      ).rejects.toThrow('Deliverable "meta-prompt.md" not found');
    });

    it('does not duplicate disclaimer if already present', async () => {
      const contentWithDisclaimer = `# Content\n\n${DISCLAIMER_TEXT}\n`;
      const repo = createMockRepo({
        loadDeliverable: vi.fn().mockResolvedValue(contentWithDisclaimer),
      });
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      const result = await useCase.exportSingle('proj-1', 'meta-prompt.md', 'markdown');
      const text = result.data.toString('utf-8');
      const count = text.split(DISCLAIMER_TEXT).length - 1;
      expect(count).toBe(1);
    });
  });

  describe('exportAll', () => {
    it('collects all deliverables and passes to zip exporter', async () => {
      const deliverables: DeliverableName[] = ['meta-prompt.md', 'phase0-research-plan.md'];
      const repo = createMockRepo({
        listDeliverables: vi.fn().mockResolvedValue(deliverables),
        loadDeliverable: vi.fn().mockResolvedValue('# Content'),
      });
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      const result = await useCase.exportAll('proj-1');

      expect(mockZipExporter).toHaveBeenCalledOnce();
      const [projectId, deliverablesMap] = mockZipExporter.mock.calls[0];
      expect(projectId).toBe('proj-1');
      expect(deliverablesMap).toBeInstanceOf(Map);
      expect(deliverablesMap.size).toBe(2);
      expect(result).toBe(zipResult);
    });

    it('throws when no deliverables exist', async () => {
      const repo = createMockRepo();
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      await expect(useCase.exportAll('proj-1')).rejects.toThrow('No deliverables found');
    });

    it('includes disclaimer in each deliverable', async () => {
      const repo = createMockRepo({
        listDeliverables: vi.fn().mockResolvedValue(['meta-prompt.md'] as DeliverableName[]),
        loadDeliverable: vi.fn().mockResolvedValue('# Raw content'),
      });
      const useCase = new ExportDeliverableUseCase(
        repo, mockExcelExporter, mockMarkdownExporter, mockZipExporter,
      );

      await useCase.exportAll('proj-1');

      const delivMap: Map<string, string> = mockZipExporter.mock.calls[0][1];
      const content = delivMap.get('meta-prompt.md')!;
      expect(content).toContain(DISCLAIMER_TEXT);
    });
  });
});
