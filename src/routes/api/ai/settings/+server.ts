import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTableRole, upsertAiSettings } from '$lib/db/queries';

const FIELDS = [
  'providerType', 'hostedProvider', 'endpointUrl', 'apiKeyRef',
  'modelName', 'aiEnabled', 'permissionLevel', 'runMode',
  'maxRunFrequency', 'frequency', 'previewBeforeSave',
  'aiInventorySuggestions', 'onNoteUpload', 'onRequestSubmit',
  'onRequestResolve', 'dailyDigestTime', 'weeklySummaryDay',
  'enabledActionsJson'
];

function extractSettings(body: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  // Map apiKey → apiKeyRef
  if (body.apiKey) data.apiKeyRef = body.apiKey;
  // Map frequency → maxRunFrequency (keep both)
  if (body.frequency && !data.maxRunFrequency) data.maxRunFrequency = body.frequency;
  return data;
}

async function handleSave({ request, locals }: { request: Request; locals: any }) {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tableId } = body;
  if (!tableId) return json({ error: 'Missing tableId' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role || role.role !== 'dm') return json({ error: 'Forbidden' }, { status: 403 });

  const data = extractSettings(body);
  const settings = await upsertAiSettings(tableId, {
    providerType: data.providerType || 'hosted_api',
    hostedProvider: data.hostedProvider || null,
    endpointUrl: data.endpointUrl || null,
    modelName: data.modelName || null,
    apiKeyRef: data.apiKeyRef || null,
    aiEnabled: data.aiEnabled ?? false,
    permissionLevel: data.permissionLevel ?? 0,
    runMode: data.runMode || 'manual',
    maxRunFrequency: data.maxRunFrequency || null,
    frequency: data.frequency || 'normal',
    previewBeforeSave: data.previewBeforeSave ?? true,
    aiInventorySuggestions: data.aiInventorySuggestions ?? true,
    onNoteUpload: data.onNoteUpload ?? false,
    onRequestSubmit: data.onRequestSubmit ?? false,
    onRequestResolve: data.onRequestResolve ?? false,
    dailyDigestTime: data.dailyDigestTime || '08:00',
    weeklySummaryDay: data.weeklySummaryDay || 'monday',
    enabledActionsJson: data.enabledActionsJson || null,
  });

  // Never return apiKey to client
  return json({ success: true, settings: { ...settings, apiKeyRef: settings.apiKeyRef ? '••••' : null } });
}

export const POST: RequestHandler = handleSave;
export const PUT: RequestHandler = handleSave;
