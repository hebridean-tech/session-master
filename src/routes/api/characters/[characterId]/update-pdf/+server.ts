import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAiSettings, getUserTableRole, createCharacterClasses } from '$lib/db/queries';
import { callAi, type AiProviderConfig } from '$lib/ai/provider';

function toProviderConfig(settings: NonNullable<Awaited<ReturnType<typeof getAiSettings>>>): AiProviderConfig {
  return {
    providerType: settings.providerType as AiProviderConfig['providerType'],
    hostedProvider: settings.hostedProvider || null,
    endpointUrl: settings.endpointUrl,
    modelName: settings.modelName,
    apiKey: settings.apiKeyRef || null,
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const tableId = formData.get('tableId') as string;
  const characterId = formData.get('characterId') as string;
  const file = formData.get('file') as File;

  if (!tableId || !characterId || !file) return json({ error: 'Missing fields' }, { status: 400 });

  const role = await getUserTableRole(session.user.id, tableId);
  if (!role) return json({ error: 'Forbidden' }, { status: 403 });

  const settings = await getAiSettings(tableId);

  // Extract text from PDF
  let text = '';
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    if (file.type === 'application/pdf') {
      const tmpPath = `/tmp/sheet-${Date.now()}.pdf`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { writeFile, unlink } = await import('fs/promises');
      await writeFile(tmpPath, buf);
      try {
        const { stdout } = await execFileAsync('pdftotext', ['-layout', tmpPath, '-']);
        text = stdout;
      } finally {
        await unlink(tmpPath);
      }
    } else {
      text = await file.text();
    }
  } catch (e: any) {
    return json({ error: 'Failed to read file: ' + e.message }, { status: 400 });
  }

  if (!text.trim()) return json({ error: 'Could not extract text from the file.' }, { status: 400 });

  if (settings && settings.permissionLevel >= 1) {
    try {
      const result = await callAi(toProviderConfig(settings), [
        {
          role: 'system',
          content: `You are a D&D character sheet parser. Extract ALL data from a D&D Beyond character sheet PDF.

ABILITY SCORE RULES:
- Scores are 3-30 (typically 8-20). Modifiers are small (+3, -1, +0).
- Modifier = floor((score - 10) / 2). Score 13 → +1, score 5 → -3.
- NEVER use a modifier as a score.

MULTI-CLASS DETECTION:
- Look for multiple class names (e.g. "Fighter 5 / Rogue 3")
- Total level is the sum of all class levels
- For each class: className, subclass, classLevel, isPrimary

Return ONLY a JSON object with ALL of these fields (use null for anything not found):
{
  "characterName": string,
  "classes": [{ "className": string, "subclass": string or null, "classLevel": number, "isPrimary": boolean }],
  "level": number (total level),
  "characterClass": string (primary class name),
  "subclass": string or null (primary subclass),
  "ancestryOrSpecies": string,
  "background": string or null,
  "alignment": string or null,
  "ac": number,
  "hpMax": number,
  "hpCurrent": number,
  "speed": number,
  "proficiencyBonus": number,
  "xp": number,
  "abilityScores": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number },
  "skillProficiencies": string[],
  "toolProficiencies": string[],
  "languages": string[],
  "personalityTraits": string or null,
  "ideals": string or null,
  "bonds": string or null,
  "flaws": string or null,
  "backstory": string or null,
  "spells": [{ "name": string, "level": number, "school": string or null, "prepared": boolean, "source": string }],
  "inventory": [{ "name": string, "quantity": number, "weight": number, "notes": string or null, "isMagic": boolean }],
  "currency": { "cp": number, "sp": number, "ep": number, "gp": number, "pp": number }
}
Return ONLY the JSON, no markdown fences or explanation.`,
        },
        { role: 'user', content: text },
      ], { maxTokens: 8192, temperature: 0.1 });

      let parsed: Record<string, any>;
      const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return json({ error: 'AI returned invalid JSON', rawText: text }, { status: 500 });
      }

      return json({ success: true, source: 'ai', data: parsed });
    } catch (e: any) {
      return json({ success: true, source: 'raw', data: null, rawText: text, aiError: e.message });
    }
  }

  return json({ success: true, source: 'raw', data: null, rawText: text });
};
