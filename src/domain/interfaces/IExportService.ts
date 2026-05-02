export type ExportFormat = 'markdown' | 'xlsx' | 'zip';

export interface ExportResult {
  readonly filename: string;
  readonly mimeType: string;
  readonly data: Buffer;
}

export interface IExportService {
  exportDeliverable(
    projectId: string,
    deliverableName: string,
    format: ExportFormat
  ): Promise<ExportResult>;

  exportAll(projectId: string): Promise<ExportResult>;
}
