import { NextResponse } from 'next/server';
import { getProjectRepo } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';
import type { DeliverableName } from '@/domain/interfaces/IProjectRepository';

const VALID_DELIVERABLES: ReadonlySet<string> = new Set<DeliverableName>([
  'project.json',
  'meta-prompt.md',
  'phase0-research-plan.md',
  'phase1-azure-architecture.md',
  'phase2-cost-estimate.md',
  'phase3-proposal.md',
  'review-report.md',
  'final-review-report.md',
]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as { filename?: string; content?: string };

    if (!body.filename || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'filename and content are required' },
        { status: 400 },
      );
    }

    if (!VALID_DELIVERABLES.has(body.filename)) {
      return NextResponse.json(
        { error: `Invalid deliverable name: ${body.filename}` },
        { status: 400 },
      );
    }

    const repo = getProjectRepo();
    const project = await repo.get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await repo.saveDeliverable(projectId, body.filename as DeliverableName, body.content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
