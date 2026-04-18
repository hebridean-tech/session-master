/**
 * Heuristic parser for D&D class feature descriptions.
 * Determines actionType, resourceType, damage, and damageType from feature text.
 */

const DAMAGE_TYPES = ['acid','bludgeoning','cold','fire','force','lightning','necrotic','poison','psychic','radiant','slashing','piercing','thunder'];

export interface ParsedFeature {
  actionType: 'action' | 'bonus_action' | 'reaction' | 'free' | 'passive' | 'special' | 'attack_action';
  resourceType?: string;
  resourceMax?: number;
  damage?: string;
  damageType?: string;
  tags: string[];
}

export function parseFeatureActionType(description: string): ParsedFeature {
  if (!description) return { actionType: 'passive', tags: [] };

  const d = description.toLowerCase();
  const tags: string[] = [];

  // Action type
  let actionType: ParsedFeature['actionType'] = 'passive';

  if (d.includes('bonus action')) {
    actionType = 'bonus_action';
  } else if (d.includes('reaction')) {
    actionType = 'reaction';
    tags.push('reaction');
  } else if (d.includes('extra attack') || d.includes('you can attack twice')) {
    actionType = 'attack_action';
  } else if (d.includes('as an action') || (d.includes('on your turn') && !d.includes('bonus'))) {
    actionType = 'action';
  } else if (d.includes('free action') || d.includes('no action')) {
    actionType = 'free';
  } else if (d.includes('use your action') || d.includes('take the attack action') || d.includes('as an action')) {
    actionType = 'action';
  } else if (d.includes('concentration')) {
    tags.push('concentration');
  }

  // Resource type
  let resourceType: string | undefined;
  let resourceMax: number | undefined;

  const srMatch = d.match(/(\d+)\s*\/\s*short\s*rest/);
  const lrMatch = d.match(/(\d+)\s*\/\s*long\s*rest/);

  if (srMatch) {
    resourceType = 'short_rest';
    resourceMax = parseInt(srMatch[1]);
  } else if (lrMatch) {
    resourceType = 'long_rest';
    resourceMax = parseInt(lrMatch[1]);
  } else if (d.includes('ki points')) {
    resourceType = 'ki_points';
  } else if (d.includes('rage') && d.includes('uses')) {
    resourceType = 'rage_uses';
  } else if (d.includes('spell slot')) {
    resourceType = 'spell_slot';
  } else if (d.includes('lay on hands')) {
    resourceType = 'long_rest';
  }

  // Damage
  const dmgMatch = description.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
  const damage = dmgMatch ? dmgMatch[1] : undefined;

  // Damage type
  let damageType: string | undefined;
  for (const dt of DAMAGE_TYPES) {
    if (d.includes(dt)) { damageType = dt; break; }
  }

  // Additional tags
  if (d.includes('melee')) tags.push('melee');
  if (d.includes('ranged')) tags.push('ranged');
  if (d.includes('concentration')) tags.push('concentration');
  if (d.includes('once per')) tags.push('limited');

  return { actionType, resourceType, resourceMax, damage, damageType, tags };
}
