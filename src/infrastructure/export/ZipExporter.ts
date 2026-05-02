import archiver from 'archiver';
import type { ExportResult } from '@/domain/interfaces/IExportService';

export async function exportAllToZip(
  projectId: string,
  deliverables: Map<string, string>,
): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => {
      const data = Buffer.concat(chunks);
      const d = new Date();
      const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      resolve({
        filename: `${projectId}_deliverables_${date}.zip`,
        mimeType: 'application/zip',
        data,
      });
    });
    archive.on('error', reject);

    for (const [name, content] of deliverables) {
      archive.append(content, { name });
    }

    archive.finalize();
  });
}
