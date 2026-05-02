import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { FileProjectRepository } from './FileProjectRepository';
import { StepId, StepStatus } from '@/domain/models/WizardStep';
import type { DeliverableName } from '@/domain/interfaces/IProjectRepository';

describe('FileProjectRepository', () => {
  let tempDir: string;
  let repo: FileProjectRepository;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fp-repo-'));
    repo = new FileProjectRepository(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a project with UUID and initial wizard state', async () => {
      const meta = await repo.create('My Project');

      expect(meta.name).toBe('My Project');
      expect(meta.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(meta.wizardState.currentStep).toBe(StepId.CONTEXT_COLLECTION);
      expect(meta.llmProvider).toBe('openai');

      // project.json should exist on disk
      const raw = await readFile(join(tempDir, meta.id, 'project.json'), 'utf-8');
      const stored = JSON.parse(raw);
      expect(stored.id).toBe(meta.id);
    });
  });

  describe('get', () => {
    it('returns project meta by id', async () => {
      const created = await repo.create('Test');
      const fetched = await repo.get(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe('Test');
    });

    it('returns null for non-existent project', async () => {
      const result = await repo.get('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns all projects', async () => {
      await repo.create('Project A');
      await repo.create('Project B');
      const all = await repo.list();

      expect(all).toHaveLength(2);
      const names = all.map((p) => p.name).sort();
      expect(names).toEqual(['Project A', 'Project B']);
    });

    it('returns empty array when base dir does not exist', async () => {
      const emptyRepo = new FileProjectRepository(join(tempDir, 'nonexistent'));
      const result = await emptyRepo.list();
      expect(result).toEqual([]);
    });
  });

  describe('updateWizardState', () => {
    it('merges partial wizard state into project.json', async () => {
      const project = await repo.create('WS Test');
      await repo.updateWizardState(project.id, {
        currentStep: StepId.RESEARCH_PLAN,
        steps: {
          ...project.wizardState.steps,
          [StepId.CONTEXT_COLLECTION]: StepStatus.COMPLETED,
        },
      });

      const updated = await repo.get(project.id);
      expect(updated!.wizardState.currentStep).toBe(StepId.RESEARCH_PLAN);
      expect(updated!.wizardState.steps[StepId.CONTEXT_COLLECTION]).toBe(StepStatus.COMPLETED);
    });
  });

  describe('saveDeliverable', () => {
    it('saves deliverable content to file', async () => {
      const project = await repo.create('Deliverable Test');
      await repo.saveDeliverable(project.id, 'meta-prompt.md', '# Hello');

      const content = await readFile(join(tempDir, project.id, 'meta-prompt.md'), 'utf-8');
      expect(content).toBe('# Hello');
    });

    it('performs atomic write (tmp then rename)', async () => {
      const project = await repo.create('Atomic Test');
      await repo.saveDeliverable(project.id, 'meta-prompt.md', 'content');

      // After successful write, .tmp file should not remain
      const dir = join(tempDir, project.id);
      const files = await readdir(dir);
      expect(files).not.toContain('meta-prompt.md.tmp');
      expect(files).toContain('meta-prompt.md');
    });

    it('rejects invalid deliverable name', async () => {
      const project = await repo.create('Invalid Name Test');
      await expect(
        repo.saveDeliverable(project.id, 'malicious.exe' as DeliverableName, 'bad'),
      ).rejects.toThrow('Invalid deliverable name');
    });
  });

  describe('loadDeliverable', () => {
    it('loads deliverable content', async () => {
      const project = await repo.create('Load Test');
      await repo.saveDeliverable(project.id, 'phase0-research-plan.md', '# Plan');

      const content = await repo.loadDeliverable(project.id, 'phase0-research-plan.md');
      expect(content).toBe('# Plan');
    });

    it('returns null for missing deliverable', async () => {
      const project = await repo.create('Missing Test');
      const content = await repo.loadDeliverable(project.id, 'meta-prompt.md');
      expect(content).toBeNull();
    });
  });

  describe('listDeliverables', () => {
    it('lists only valid deliverable names', async () => {
      const project = await repo.create('List Test');
      const dir = join(tempDir, project.id);

      await repo.saveDeliverable(project.id, 'meta-prompt.md', '# MP');
      await repo.saveDeliverable(project.id, 'phase0-research-plan.md', '# RP');
      // Write a non-deliverable file directly
      await writeFile(join(dir, 'notes.txt'), 'random notes', 'utf-8');

      const deliverables = await repo.listDeliverables(project.id);
      expect(deliverables).toContain('meta-prompt.md');
      expect(deliverables).toContain('phase0-research-plan.md');
      expect(deliverables).toContain('project.json');
      expect(deliverables).not.toContain('notes.txt');
    });

    it('returns empty array for non-existent project', async () => {
      const result = await repo.listDeliverables('00000000-0000-0000-0000-000000000000');
      expect(result).toEqual([]);
    });
  });

  describe('security', () => {
    it('blocks path traversal in project ID', async () => {
      await expect(repo.get('../etc/passwd' as string)).rejects.toThrow();
    });

    it('blocks path traversal with dots in project ID', async () => {
      await expect(repo.get('..%2F..%2Fetc' as string)).rejects.toThrow();
    });

    it('blocks path traversal with slashes', async () => {
      await expect(repo.get('foo/../../etc' as string)).rejects.toThrow();
    });

    it('blocks invalid deliverable names for save', async () => {
      const project = await repo.create('Security Test');
      await expect(
        repo.saveDeliverable(project.id, '../outside.md' as DeliverableName, 'evil'),
      ).rejects.toThrow('Invalid deliverable name');
    });

    it('blocks invalid deliverable names for load', async () => {
      const project = await repo.create('Security Test 2');
      await expect(
        repo.loadDeliverable(project.id, '../../secret.md' as DeliverableName),
      ).rejects.toThrow('Invalid deliverable name');
    });
  });
});
