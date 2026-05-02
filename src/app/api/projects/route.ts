import { NextResponse } from 'next/server';
import { getProjectRepo } from '@/app/api/_lib/dependencies';
import { validateProjectName } from '@/lib/validation';
import { classifyError, type ErrorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const repo = getProjectRepo();
    const projects = await repo.list();
    return NextResponse.json(projects);
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
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
  } catch (error) {
    const errResponse: ErrorResponse = classifyError(error);
    return NextResponse.json(errResponse, { status: 500 });
  }
}
