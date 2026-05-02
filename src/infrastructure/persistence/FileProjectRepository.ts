import { readFile, writeFile, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ProjectMeta, DeliverableName, IProjectRepository } from '@/domain/interfaces/IProjectRepository';
import type { WizardState } from '@/domain/models/WizardStep';
import { createInitialWizardState } from '@/domain/models/WizardStep';
import { validateProjectName } from '@/lib/validation';

const DELIVERABLE_ALLOWLIST: ReadonlySet<string> = new Set<DeliverableName>([
  'project.json',
  'meta-prompt.md',
  'phase0-research-plan.md',
  'phase1-azure-architecture.md',
  'phase2-cost-estimate.md',
  'phase3-proposal.md',
  'review-report.md',
  'final-review-report.md',
]);

function isDeliverableName(name: string): name is DeliverableName {
  return DELIVERABLE_ALLOWLIST.has(name);
}

export class FileProjectRepository implements IProjectRepository {
  private readonly baseDir: string;

  constructor(baseDir: string = 'data/projects') {
    this.baseDir = resolve(baseDir);
  }

  private projectDir(projectId: string): string {
    this.assertSafeId(projectId);
    const dir = join(this.baseDir, projectId);
    this.assertPathContainment(dir);
    return dir;
  }

  private assertSafeId(id: string): void {
    const result = validateProjectName(id);
    if (!result.valid) {
      throw new Error(`Invalid project ID: ${result.error}`);
    }
  }

  private assertPathContainment(targetPath: string): void {
    const resolved = resolve(targetPath);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error('Path traversal detected');
    }
  }

  private assertDeliverableName(filename: string): asserts filename is DeliverableName {
    if (!isDeliverableName(filename)) {
      throw new Error(`Invalid deliverable name: ${filename}`);
    }
  }

  async list(): Promise<ProjectMeta[]> {
    if (!existsSync(this.baseDir)) return [];

    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const results: ProjectMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const meta = await this.get(entry.name);
        if (meta) results.push(meta);
      } catch {
        // skip malformed projects
      }
    }

    return results;
  }

  async get(projectId: string): Promise<ProjectMeta | null> {
    const dir = this.projectDir(projectId);
    const metaPath = join(dir, 'project.json');

    try {
      const raw = await readFile(metaPath, 'utf-8');
      return JSON.parse(raw) as ProjectMeta;
    } catch {
      return null;
    }
  }

  async create(name: string): Promise<ProjectMeta> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const wizardState = createInitialWizardState(id);

    const meta: ProjectMeta = {
      id,
      name,
      wizardState,
      llmProvider: 'openai',
      createdAt: now,
      updatedAt: now,
    };

    const dir = this.projectDir(id);
    await mkdir(dir, { recursive: true });
    await this.atomicWrite(join(dir, 'project.json'), JSON.stringify(meta, null, 2));

    return meta;
  }

  async updateWizardState(projectId: string, state: Partial<WizardState>): Promise<void> {
    const dir = this.projectDir(projectId);
    const metaPath = join(dir, 'project.json');

    const raw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw) as ProjectMeta;

    const updated: ProjectMeta = {
      ...meta,
      wizardState: { ...meta.wizardState, ...state, updatedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    };

    await this.atomicWrite(metaPath, JSON.stringify(updated, null, 2));
  }

  async saveDeliverable(projectId: string, filename: DeliverableName, content: string): Promise<void> {
    this.assertDeliverableName(filename);
    const dir = this.projectDir(projectId);
    const filePath = join(dir, filename);
    this.assertPathContainment(filePath);

    if (!existsSync(dir)) {
      throw new Error(`Project ${projectId} not found`);
    }

    await this.atomicWrite(filePath, content);
  }

  async loadDeliverable(projectId: string, filename: DeliverableName): Promise<string | null> {
    this.assertDeliverableName(filename);
    const dir = this.projectDir(projectId);
    const filePath = join(dir, filename);
    this.assertPathContainment(filePath);

    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listDeliverables(projectId: string): Promise<DeliverableName[]> {
    const dir = this.projectDir(projectId);

    try {
      const entries = await readdir(dir);
      return entries.filter((e): e is DeliverableName => isDeliverableName(e));
    } catch {
      return [];
    }
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
  }
}
