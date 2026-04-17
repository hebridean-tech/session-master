import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSessionNote, createNoteFile, getUserTableRole } from '$lib/db/queries';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tableId, title, storagePath, originalFilename, mimeType, sizeBytes, content } = body;
  const userId = session.user.id;

  if (!tableId || !storagePath || !originalFilename) {
    return json({ error: 'Missing fields' }, { status: 400 });
  }

  const role = await getUserTableRole(userId, tableId);
  if (!role) return json({ error: 'Not a member' }, { status: 403 });

  // For MVP: store path only, actual file upload would need multipart
  // Create the note and file record
  const note = await createSessionNote({
    tableId,
    authorUserId: userId,
    title: title || originalFilename,
    body: `Uploaded file: ${originalFilename}`,
    sourceType: 'upload',
    visibility: body.visibility || 'table',
    sessionLabel: body.sessionLabel || undefined,
  });

  const file = await createNoteFile({
    noteId: note.id,
    storagePath,
    originalFilename,
    mimeType,
    sizeBytes,
  });

  // Ensure upload directory exists
  const fullPath = path.join(process.cwd(), 'static', storagePath);
  await mkdir(path.dirname(fullPath), { recursive: true });

  await writeFile(fullPath, content ? Buffer.from(content, 'base64') : '');

  return json({ noteId: note.id, fileId: file.id, title: note.title });
};
