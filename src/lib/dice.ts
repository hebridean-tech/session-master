export interface RollResult {
  dice: number[];
  modifier: number;
  total: number;
  mode: 'normal' | 'advantage' | 'disadvantage';
}

export function parseAndRoll(expression: string, modifier = 0, mode: 'normal' | 'advantage' | 'disadvantage' = 'normal'): RollResult {
  const trimmed = expression.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)d(\d+)$/);

  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);

  if (count < 1 || count > 100 || sides < 1 || sides > 1000) {
    throw new Error('Dice values out of range');
  }

  // For advantage/disadvantage with d20, roll 2 and pick
  let dice: number[];
  if ((mode === 'advantage' || mode === 'disadvantage') && sides === 20) {
    const a = rollDie(sides);
    const b = rollDie(sides);
    dice = mode === 'advantage' ? [Math.max(a, b)] : [Math.min(a, b)];
  } else {
    dice = Array.from({ length: count }, () => rollDie(sides));
  }

  const sum = dice.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return { dice, modifier, total, mode };
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function formatResult(r: RollResult): string {
  const diceStr = r.dice.join(', ');
  const modStr = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
  const modeStr = r.mode !== 'normal' ? ` (${r.mode})` : '';
  return `[${diceStr}] ${modStr} = ${r.total}${modeStr}`;
}
