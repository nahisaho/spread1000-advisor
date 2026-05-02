import { NextResponse } from 'next/server';
import { getProjectRepo } from '@/app/api/_lib/dependencies';
import { ExportDeliverableUseCase } from '@/application/usecases/ExportDeliverableUseCase';
import { exportProposalToMarkdown } from '@/infrastructure/export/MarkdownExporter';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import type { ExportFormat } from '@/domain/interfaces/IExportService';

const VALID_FORMATS: ReadonlySet<string> = new Set<ExportFormat>([
  'markdown',
  'xlsx',
  'zip',
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; format: string }> },
) {
  try {
    const { projectId, format } = await params;

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { error: `Invalid format: ${format}. Must be one of: markdown, xlsx, zip` },
        { status: 400 },
      );
    }

    const repo = getProjectRepo();
    const project = await repo.get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const excelExporter = async () => {
      throw new Error('Excel export not yet implemented');
    };
    const zipExporter = async () => {
      throw new Error('Zip export not yet implemented');
    };

    const uc = new ExportDeliverableUseCase(
      repo,
      excelExporter,
      exportProposalToMarkdown,
      zipExporter,
    );

    if (format === 'zip') {
      const result = await uc.exportAll(projectId);
      return new Response(new Uint8Array(result.data), {
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      });
    }

    // For markdown and xlsx, export the proposal
    const result = await uc.exportSingle(
      projectId,
      'phase3-proposal.md',
      format as ExportFormat,
    );

    return new Response(new Uint8Array(result.data), {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
