import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAiSettings, getUserTableRole } from '$lib/db/queries';
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
  const file = formData.get('file') as File;

  if (!tableId || !file) return json({ error: 'Missing tableId or file' }, { status: 400 });

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

  // Pre-extract ability scores from saving throws section
  const savingThrowPattern = /^(STRENGTH|DEXTERITY|CONSTITUTION|INTELLIGENCE|WISDOM|CHARISMA)\s*\n?\s*(\d{1,2})/gm;
  let m;
  const extractedScores: Record<string, string> = {};
  while ((m = savingThrowPattern.exec(text)) !== null) {
    const ability = m[1].slice(0, 3).toLowerCase();
    const score = parseInt(m[2]);
    if (score >= 3 && score <= 30 && !extractedScores[ability]) {
      extractedScores[ability] = String(score);
    }
  }

  let scoreHint = '';
  if (Object.keys(extractedScores).length > 0) {
    scoreHint = `\n\nPRE-EXTRACTED ABILITY SCORES (use these directly):\n${JSON.stringify(extractedScores)}`;
  }

  // AI parsing
  if (settings && settings.permissionLevel >= 1) {
    try {
      const result = await callAi(toProviderConfig(settings), [
        {
          role: 'system',
          content: `You are a D&D character sheet parser. Extract ALL data from a D&D Beyond character sheet PDF.

ABILITY SCORE RULES:
- Scores are 3-30 (typically 8-20). Modifiers are small (+3, -1, +0).
- Modifier = floor((score - 10) / 2). Score 13 → +1, score 5 → -3.
- NEVER use a modifier as a score. If pre-extracted scores are given, use them.

MULTI-CLASS DETECTION:
- Look for multiple class names (e.g. "Fighter 5 / Rogue 3" or "Level 8 (Fighter 5, Rogue 3)")
- The total level is the sum of all class levels
- For each class, extract: className, subclass (if any), classLevel
- The first class listed is the primary class
- If only one class is found, put it in the classes array with its full level

Return ONLY a JSON object with ALL of these fields (use null for anything not found):
{
  "characterName": string,
  "classes": [
    { "className": string, "subclass": string or null, "classLevel": number, "isPrimary": boolean }
  ],
  "level": number (total level, sum of all class levels),
  "characterClass": string (primary class name, for backward compat),
  "subclass": string or null (primary subclass, for backward compat),
  "ancestryOrSpecies": string,
  "background": string or null,
  "alignment": string or null (two letters like "NG", "CN"),
  "ac": number (armor class),
  "hpMax": number (max hit points),
  "hpCurrent": number (current hit points, or same as max if not specified),
  "speed": number in feet,
  "proficiencyBonus": number,
  "xp": number,
  "abilityScores": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number },
  "skillProficiencies": string[] (skill names with ability tag removed, e.g. "Athletics" not "Athletics STR"),
  "toolProficiencies": string[],
  "languages": string[],
  "personalityTraits": string or null,
  "ideals": string or null,
  "bonds": string or null,
  "flaws": string or null,
  "backstory": string or null,
  "spells": [
    { "name": string, "level": number (0=cantrip), "school": string or null, "prepared": boolean, "source": string (e.g. "Artificer") }
  ],
  "inventory": [
    { "name": string, "quantity": number, "weight": number in lbs, "notes": string or null, "isMagic": boolean }
  ],
  "currency": { "cp": number, "sp": number, "ep": number, "gp": number, "pp": number }
}
Return ONLY the JSON, no markdown fences or explanation.`,
        },
        { role: 'user', content: text + scoreHint },
      ], { maxTokens: 8192, temperature: 0.1 });

      let parsed: Record<string, any>;
      const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return json({ error: 'AI returned invalid JSON', rawText: text, aiRaw: result.content }, { status: 500 });
      }

      return json({ success: true, source: 'ai', data: parsed });
    } catch (e: any) {
      return json({ success: true, source: 'raw', data: null, rawText: text, aiError: e.message });
    }
  }

  return json({ success: true, source: 'raw', data: null, rawText: text });
};
