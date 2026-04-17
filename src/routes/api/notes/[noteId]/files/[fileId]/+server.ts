import { stat, readFile } from 'fs/promises';
import path from 'path';
import type { RequestHandler } from './$types';
import { getSessionNoteFiles } from '$lib/db/queries';

export const GET: RequestHandler = async ({ params }) => {
  const { noteId, fileId } = params;

  const files = await getSessionNoteFiles(noteId);
  const file = files.find(f => f.id === fileId);
  if (!file) return new Response('Not found', { status: 404 });

  const fullPath = path.join(process.cwd(), 'static', file.storagePath);
  try {
    const buf = await readFile(fullPath);
    return new Response(buf, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.originalFilename}"`,
        'Content-Length': String(file.sizeBytes),
      },
    });
  } catch {
    // File not on disk — return 404
    return new Response('File not found on disk', { status: 404 });
  }
};
