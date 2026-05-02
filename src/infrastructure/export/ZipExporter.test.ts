import { describe, it, expect } from 'vitest';
import { exportAllToZip } from './ZipExporter';

describe('ZipExporter', () => {
  it('creates a valid zip buffer', async () => {
    const deliverables = new Map<string, string>([
      ['plan.md', '# Research Plan'],
      ['report.md', '# Report'],
    ]);

    const result = await exportAllToZip('proj-1', deliverables);

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe('application/zip');
    // ZIP magic bytes: PK\x03\x04
    expect(result.data[0]).toBe(0x50); // P
    expect(result.data[1]).toBe(0x4b); // K
  });

  it('filename matches expected pattern', async () => {
    const deliverables = new Map([['a.md', 'content']]);
    const result = await exportAllToZip('proj-1', deliverables);

    expect(result.filename).toMatch(/^proj-1_deliverables_\d{8}\.zip$/);
  });

  it('includes all deliverables in archive', async () => {
    const deliverables = new Map<string, string>([
      ['file1.md', 'Content 1'],
      ['file2.md', 'Content 2'],
      ['file3.txt', 'Content 3'],
    ]);

    const result = await exportAllToZip('proj-1', deliverables);

    // Verify all filenames appear in the zip binary
    const zipStr = result.data.toString('binary');
    expect(zipStr).toContain('file1.md');
    expect(zipStr).toContain('file2.md');
    expect(zipStr).toContain('file3.txt');
  });
});
