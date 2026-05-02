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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; name: string }> },
) {
  try {
    const { projectId, name } = await params;

    if (!VALID_DELIVERABLES.has(name)) {
      return NextResponse.json(
        { error: `Invalid deliverable name: ${name}` },
        { status: 400 },
      );
    }

    const repo = getProjectRepo();
    const content = await repo.loadDeliverable(projectId, name as DeliverableName);
    if (content === null) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    if (name.endsWith('.json')) {
      try {
        const parsed: unknown = JSON.parse(content);
        return NextResponse.json(parsed);
      } catch {
        return new Response(content, {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
