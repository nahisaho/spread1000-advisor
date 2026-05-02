import { NextResponse } from 'next/server';
import { getProjectRepo } from '../route';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const repo = getProjectRepo();
    const project = await repo.get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}
