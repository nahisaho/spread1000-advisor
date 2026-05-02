import { NextResponse } from 'next/server';
import { getProjectRepo } from '@/app/api/_lib/dependencies';
import { classifyError, type ErrorResponse } from '@/lib/errors';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const repo = getProjectRepo();

    const project = await repo.get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await repo.updateWizardState(projectId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
