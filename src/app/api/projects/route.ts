import { NextResponse } from 'next/server';
import { FileProjectRepository } from '@/infrastructure/persistence/FileProjectRepository';
import { validateProjectName } from '@/lib/validation';

let repoInstance: FileProjectRepository | null = null;

export function getProjectRepo(): FileProjectRepository {
  if (!repoInstance) {
    repoInstance = new FileProjectRepository();
  }
  return repoInstance;
}

export async function GET() {
  try {
    const repo = getProjectRepo();
    const projects = await repo.list();
    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validation = validateProjectName(name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const repo = getProjectRepo();
    const project = await repo.create(name);
    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
