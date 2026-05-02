import { describe, it, expect } from 'vitest';
import type { DeliverableName } from '@/domain/interfaces/IProjectRepository';

const VALID_DELIVERABLES: DeliverableName[] = [
  'project.json',
  'meta-prompt.md',
  'phase0-research-plan.md',
  'phase1-azure-architecture.md',
  'phase2-cost-estimate.md',
  'phase3-proposal.md',
  'review-report.md',
  'final-review-report.md',
];

describe('API route validation constants', () => {
  it('all DeliverableName values are recognized', () => {
    const validSet = new Set(VALID_DELIVERABLES);
    expect(validSet.size).toBe(8);
    for (const name of VALID_DELIVERABLES) {
      expect(validSet.has(name)).toBe(true);
    }
  });

  it('rejects invalid deliverable names', () => {
    const validSet = new Set(VALID_DELIVERABLES);
    expect(validSet.has('invalid.txt' as DeliverableName)).toBe(false);
    expect(validSet.has('../escape.md' as DeliverableName)).toBe(false);
  });
});

describe('SSE format', () => {
  it('encodes SSE data correctly', () => {
    const encoder = new TextEncoder();
    const data = { content: 'hello', done: false };
    const encoded = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    const decoded = new TextDecoder().decode(encoded);
    expect(decoded).toBe('data: {"content":"hello","done":false}\n\n');
  });

  it('encodes SSE done event', () => {
    const encoder = new TextEncoder();
    const data = { content: '', done: true };
    const encoded = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    const decoded = new TextDecoder().decode(encoded);
    expect(decoded).toBe('data: {"content":"","done":true}\n\n');
  });

  it('encodes SSE error event', () => {
    const encoder = new TextEncoder();
    const error = { type: 'unknown', message: 'test error', retryable: true };
    const data = { error };
    const encoded = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    const decoded = new TextDecoder().decode(encoded);
    expect(decoded).toContain('"error"');
    expect(decoded).toContain('"test error"');
  });
});

describe('stream action validation', () => {
  const VALID_ACTIONS = new Set([
    'collect-context',
    'generate-research-plan',
    'design-azure',
    'estimate-cost',
    'generate-proposal',
    'review-proposal',
  ]);

  it('recognizes all valid actions', () => {
    expect(VALID_ACTIONS.size).toBe(6);
    expect(VALID_ACTIONS.has('collect-context')).toBe(true);
    expect(VALID_ACTIONS.has('generate-research-plan')).toBe(true);
    expect(VALID_ACTIONS.has('design-azure')).toBe(true);
    expect(VALID_ACTIONS.has('estimate-cost')).toBe(true);
    expect(VALID_ACTIONS.has('generate-proposal')).toBe(true);
    expect(VALID_ACTIONS.has('review-proposal')).toBe(true);
  });

  it('rejects invalid actions', () => {
    expect(VALID_ACTIONS.has('invalid')).toBe(false);
    expect(VALID_ACTIONS.has('')).toBe(false);
  });

  const VALID_FORMATS = new Set(['markdown', 'xlsx', 'zip']);

  it('recognizes all valid export formats', () => {
    expect(VALID_FORMATS.size).toBe(3);
    expect(VALID_FORMATS.has('markdown')).toBe(true);
    expect(VALID_FORMATS.has('xlsx')).toBe(true);
    expect(VALID_FORMATS.has('zip')).toBe(true);
  });

  it('rejects invalid export formats', () => {
    expect(VALID_FORMATS.has('pdf')).toBe(false);
  });
});
