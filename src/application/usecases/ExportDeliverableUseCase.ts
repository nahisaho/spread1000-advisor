import type { IProjectRepository, DeliverableName } from '@/domain/interfaces/IProjectRepository';
import type { ExportFormat, ExportResult } from '@/domain/interfaces/IExportService';
import type { Proposal } from '@/domain/models/Proposal';
import { appendDisclaimer } from '@/lib/disclaimer';

type ExcelExporterFn = (proposal: Proposal, projectId: string) => Promise<ExportResult>;
type MarkdownExporterFn = (proposal: Proposal, projectId: string) => ExportResult;
type ZipExporterFn = (projectId: string, deliverables: Map<string, string>) => Promise<ExportResult>;

export class ExportDeliverableUseCase {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly excelExporter: ExcelExporterFn,
    private readonly markdownExporter: MarkdownExporterFn,
    private readonly zipExporter: ZipExporterFn,
  ) {}

  async exportSingle(
    projectId: string,
    deliverableName: DeliverableName,
    format: ExportFormat,
  ): Promise<ExportResult> {
    const content = await this.projectRepo.loadDeliverable(projectId, deliverableName);
    if (content === null) {
      throw new Error(`Deliverable "${deliverableName}" not found for project "${projectId}"`);
    }

    const contentWithDisclaimer = appendDisclaimer(content);

    if (format === 'xlsx') {
      const proposal = this.contentToProposal(projectId, deliverableName, contentWithDisclaimer);
      return this.excelExporter(proposal, projectId);
    }

    // markdown format
    const data = Buffer.from(contentWithDisclaimer, 'utf-8');
    return {
      filename: `${projectId}_${deliverableName}`,
      mimeType: 'text/markdown; charset=utf-8',
      data,
    };
  }

  async exportAll(projectId: string): Promise<ExportResult> {
    const deliverableNames = await this.projectRepo.listDeliverables(projectId);
    if (deliverableNames.length === 0) {
      throw new Error(`No deliverables found for project "${projectId}"`);
    }

    const deliverables = new Map<string, string>();
    for (const name of deliverableNames) {
      const content = await this.projectRepo.loadDeliverable(projectId, name);
      if (content !== null) {
        deliverables.set(name, appendDisclaimer(content));
      }
    }

    return this.zipExporter(projectId, deliverables);
  }

  private contentToProposal(projectId: string, name: string, content: string): Proposal {
    const now = new Date().toISOString();
    return {
      projectId,
      sections: [
        {
          id: 'research_purpose',
          title: name,
          content,
          charLimit: { min: 0, max: content.length + 1000 },
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
  }
}
