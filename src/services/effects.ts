import { randomUUID } from 'node:crypto';
import { clearStaticSheetCache, getCachedRows } from './staticSheetCache.js';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';
import type { StatKey } from './characters.js';

export type EffectStat = Exclude<StatKey, 'personal_trait'> | 'all';

export interface ActiveEffect {
  effectId: string;
  characterId: string;
  sourceItemId: string;
  effectName: string;
  stat: EffectStat;
  modifier: number;
  startsAt: Date;
  expiresAt: Date;
}

interface ItemEffect {
  itemId: string;
  effectName: string;
  stat: EffectStat;
  modifier: number;
  durationMinutes: number;
  stackable: boolean;
}

function integer(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validStat(value: string): value is EffectStat {
  return ['strength', 'agility', 'dexterity', 'luck', 'all'].includes(value);
}

async function getItemEffects(itemId: string): Promise<ItemEffect[]> {
  const rows = await getCachedRows('StatItemEffects');
  return rows
    .filter((row) => row.item_id === itemId && validStat(row.stat))
    .map((row) => ({
      itemId,
      effectName: row.effect_name || itemId,
      stat: row.stat as EffectStat,
      modifier: integer(row.modifier),
      durationMinutes: Math.max(1, integer(row.duration_minutes)),
      stackable: (row.stackable ?? '').trim().toUpperCase() === 'TRUE'
    }));
}

export async function getActiveEffects(characterId: string): Promise<ActiveEffect[]> {
  const now = Date.now();
  const rows = await getCachedRows('ActiveEffects');
  return rows
    .filter((row) => row.character_id === characterId && new Date(row.expires_at).getTime() > now && validStat(row.stat))
    .map((row) => ({
      effectId: row.effect_id,
      characterId: row.character_id,
      sourceItemId: row.source_item_id,
      effectName: row.effect_name || row.source_item_id,
      stat: row.stat as EffectStat,
      modifier: integer(row.modifier),
      startsAt: new Date(row.starts_at),
      expiresAt: new Date(row.expires_at)
    }));
}

export async function statEffectBonus(characterId: string, stat: StatKey): Promise<{ total: number; effects: ActiveEffect[] }> {
  if (stat === 'personal_trait') return { total: 0, effects: [] };
  const effects = (await getActiveEffects(characterId)).filter((effect) => effect.stat === stat || effect.stat === 'all');
  return { total: effects.reduce((sum, effect) => sum + effect.modifier, 0), effects };
}

export async function applyItemEffects(characterId: string, itemId: string, quantity: number): Promise<ActiveEffect[]> {
  const definitions = await getItemEffects(itemId);
  if (definitions.length === 0) return [];

  return withLock('active-effects', async () => {
    const rows = await getRows('ActiveEffects');
    const now = new Date();
    const created: ActiveEffect[] = [];
    for (const definition of definitions) {
      const applications = definition.stackable ? quantity : 1;
      if (!definition.stackable) {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (row.character_id === characterId && row.source_item_id === itemId && row.stat === definition.stat) rows.splice(index, 1);
        }
      }
      for (let index = 0; index < applications; index += 1) {
        const expiresAt = new Date(now.getTime() + definition.durationMinutes * 60_000);
        const effect: ActiveEffect = {
          effectId: randomUUID(),
          characterId,
          sourceItemId: itemId,
          effectName: definition.effectName,
          stat: definition.stat,
          modifier: definition.modifier,
          startsAt: now,
          expiresAt
        };
        created.push(effect);
        rows.push({
          effect_id: effect.effectId,
          character_id: characterId,
          source_item_id: itemId,
          effect_name: effect.effectName,
          stat: effect.stat,
          modifier: String(effect.modifier),
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        } satisfies SheetRow);
      }
    }
    await replaceRows('ActiveEffects', rows.filter((row) => new Date(row.expires_at).getTime() > now.getTime()));
    clearStaticSheetCache('ActiveEffects');
    return created;
  });
}
